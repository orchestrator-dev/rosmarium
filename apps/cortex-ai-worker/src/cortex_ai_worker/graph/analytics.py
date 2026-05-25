import json
import time
from dataclasses import dataclass
from datetime import UTC, datetime

import asyncpg
import networkx as nx
import structlog
from community import best_partition  # python-louvain

log = structlog.get_logger(__name__)


@dataclass
class NodeAnalytics:
    entry_id: str
    pagerank_score: float
    betweenness_score: float
    community_id: int
    hub_score: float
    authority_score: float
    degree_in: int
    degree_out: int
    degree_total: int


class GraphAnalyticsEngine:
    async def build_networkx_graph(
        self,
        content_type: str | None,
        conn: asyncpg.Connection,
        min_weight: float = 0.0,
    ) -> nx.DiGraph:
        """
        Loads accepted graph edges from PostgreSQL into a NetworkX DiGraph.
        """
        query = """
            SELECT from_entry_id, to_entry_id, edge_type, weight
            FROM graph_edges
            WHERE is_accepted = 'accepted'
              AND weight >= $1
        """
        params: list[str | float] = [min_weight]
        if content_type:
            query += " AND from_content_type = $2"
            params.append(content_type)

        rows = await conn.fetch(query, *params)
        G = nx.DiGraph()  # noqa: N806
        for row in rows:
            G.add_edge(
                row["from_entry_id"],
                row["to_entry_id"],
                weight=row["weight"],
                edge_type=row["edge_type"],
            )
        return G

    async def compute_analytics(
        self,
        content_type: str | None,
        conn: asyncpg.Connection,
    ) -> list[NodeAnalytics]:
        """
        Builds graph, runs all analytics algorithms, returns per-node results.
        """
        start_time = time.monotonic()
        G = await self.build_networkx_graph(content_type, conn)  # noqa: N806

        node_count = G.number_of_nodes()
        edge_count = G.number_of_edges()

        if node_count < 2:
            log.info("analytics_skipped_small_graph", node_count=node_count)
            return []

        # 1. PageRank
        try:
            pagerank = nx.pagerank(G, alpha=0.85, weight="weight")
        except nx.PowerIterationFailedConvergence:
            log.warning("pagerank_convergence_failed")
            pagerank = dict.fromkeys(G.nodes(), 0.0)

        # 2. Betweenness Centrality
        k = 100 if node_count > 10000 else None
        betweenness = nx.betweenness_centrality(G, k=k, normalized=True, weight="weight")

        # 3. Community Detection (requires undirected graph)
        G_undirected = G.to_undirected()  # noqa: N806
        community_dict = best_partition(G_undirected, resolution=1.0)

        # 4. HITS Algorithm
        try:
            hubs, authorities = nx.hits(G, max_iter=1000)
        except nx.PowerIterationFailedConvergence:
            log.warning("hits_convergence_failed")
            hubs = dict.fromkeys(G.nodes(), 0.0)
            authorities = dict.fromkeys(G.nodes(), 0.0)

        # 5. Compile results
        results = []
        for node in G.nodes():
            results.append(
                NodeAnalytics(
                    entry_id=node,
                    pagerank_score=pagerank.get(node, 0.0),
                    betweenness_score=betweenness.get(node, 0.0),
                    community_id=community_dict.get(node, -1),
                    hub_score=hubs.get(node, 0.0),
                    authority_score=authorities.get(node, 0.0),
                    degree_in=G.in_degree(node),
                    degree_out=G.out_degree(node),
                    degree_total=G.degree(node),
                )
            )

        duration_ms = (time.monotonic() - start_time) * 1000
        log.info(
            "analytics_computed",
            node_count=node_count,
            edge_count=edge_count,
            computation_time_ms=duration_ms,
            content_type=content_type,
        )

        return results

    async def write_analytics_results(
        self,
        results: list[NodeAnalytics],
        conn: asyncpg.Connection,
    ) -> None:
        """
        Writes analytics results to content_entries.metadata->'graph'.
        Use asyncpg executemany for batch update \u2014 single round trip.
        """
        if not results:
            return

        now = datetime.now(UTC).isoformat()

        query = """
            UPDATE content_entries
            SET metadata = jsonb_set(
                COALESCE(metadata, '{}'::jsonb),
                '{graph}',
                $2::jsonb,
                true
            )
            WHERE id = $1
        """

        batch_data = []
        for res in results:
            graph_data = {
                "pagerankScore": res.pagerank_score,
                "betweennessScore": res.betweenness_score,
                "communityId": res.community_id,
                "hubScore": res.hub_score,
                "authorityScore": res.authority_score,
                "degreeIn": res.degree_in,
                "degreeOut": res.degree_out,
                "computedAt": now,
            }
            batch_data.append((res.entry_id, json.dumps(graph_data)))

        await conn.executemany(query, batch_data)


analytics_engine = GraphAnalyticsEngine()
