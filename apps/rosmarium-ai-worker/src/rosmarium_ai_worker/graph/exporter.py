import json
from typing import Any

import asyncpg
from rdflib import Graph

from .analytics import analytics_engine


class KnowledgeGraphExporter:
    async def export_json_ld(
        self,
        content_type: str | None,
        conn: asyncpg.Connection,
    ) -> dict[str, Any]:
        """
        Exports the knowledge graph as JSON-LD.
        Uses schema.org vocabulary for maximum interoperability.
        """
        # Fetch edges
        edges_query = """
            SELECT from_entry_id, to_entry_id, edge_type, weight
            FROM graph_edges
            WHERE is_accepted = 'accepted'
        """
        params: list[str] = []
        if content_type:
            edges_query += " AND from_content_type = $1"
            params.append(content_type)

        edges = await conn.fetch(edges_query, *params)

        # Get all entry IDs involved in the graph
        entry_ids = set()
        for row in edges:
            entry_ids.add(row["from_entry_id"])
            entry_ids.add(row["to_entry_id"])

        if not entry_ids:
            return {
                "@context": {
                    "@vocab": "https://schema.org/",
                    "rosmarium": "https://rosmarium-cos.dev/vocab#",
                    "relatedTo": "rosmarium:relatedTo",
                    "references": "rosmarium:references",
                    "mentions": "rosmarium:mentions",
                },
                "@graph": [],
            }

        # Fetch entries
        entries_query = """
            SELECT id, data->>'title' as title, published_at, 
                   (SELECT name FROM content_types WHERE id = content_type_id) as type_name
            FROM content_entries
            WHERE id = ANY($1::text[])
        """
        entries = await conn.fetch(entries_query, list(entry_ids))

        # Map entries
        entry_map = {row["id"]: row for row in entries}

        # Map edges to from_entry
        relations: dict[str, list[dict[str, Any]]] = {}
        for edge in edges:
            from_id = edge["from_entry_id"]
            to_id = edge["to_entry_id"]
            if from_id not in relations:
                relations[from_id] = []
            
            # Simple mapping to schema relationships
            rel_type = "rosmarium:relatedTo"
            if edge["edge_type"] == "reference":
                rel_type = "rosmarium:references"
            elif edge["edge_type"] == "mention":
                rel_type = "rosmarium:mentions"
                
            relations[from_id].append({
                "predicate": rel_type,
                "target": f"rosmarium:entry/{to_id}"
            })

        # Build @graph
        graph_data = []
        for entry_id, row in entry_map.items():
            type_name = row["type_name"]
            
            schema_type = "schema:Thing"
            if type_name == "article":
                schema_type = "schema:Article"
            elif type_name == "product":
                schema_type = "schema:Product"

            node = {
                "@id": f"rosmarium:entry/{entry_id}",
                "@type": schema_type,
                "schema:name": row["title"],
            }
            if row["published_at"]:
                node["schema:datePublished"] = row["published_at"].isoformat()

            # Add relationships
            for rel in relations.get(entry_id, []):
                pred = rel["predicate"]
                target = rel["target"]
                if pred not in node:
                    node[pred] = []
                node[pred].append({"@id": target})

            graph_data.append(node)

        return {
            "@context": {
                "@vocab": "https://schema.org/",
                "rosmarium": "https://rosmarium-cos.dev/vocab#",
                "relatedTo": "rosmarium:relatedTo",
                "references": "rosmarium:references",
                "mentions": "rosmarium:mentions",
            },
            "@graph": graph_data,
        }

    async def export_rdf_turtle(
        self,
        content_type: str | None,
        conn: asyncpg.Connection,
    ) -> str:
        """
        Exports as RDF Turtle format using rdflib.
        """
        json_ld_data = await self.export_json_ld(content_type, conn)
        
        # If no entries, return empty prefix string or basic turtle
        if not json_ld_data["@graph"]:
            return "@prefix rosmarium: <https://rosmarium-cos.dev/vocab#> .\n@prefix schema: <https://schema.org/> .\n"

        # Parse JSON-LD into rdflib Graph
        g = Graph()
        # Parse it as json-ld
        g.parse(data=json.dumps(json_ld_data), format="json-ld")
        
        # Serialize to turtle
        return g.serialize(format="turtle")

    async def export_cytoscape(
        self,
        content_type: str | None,
        conn: asyncpg.Connection,
        include_analytics: bool = True,
    ) -> dict[str, Any]:
        """
        Cytoscape.js JSON format \u2014 for external visualisation tools.
        """
        edges_query = """
            SELECT from_entry_id, to_entry_id, edge_type, weight
            FROM graph_edges
            WHERE is_accepted = 'accepted'
        """
        params: list[str] = []
        if content_type:
            edges_query += " AND from_content_type = $1"
            params.append(content_type)

        edges = await conn.fetch(edges_query, *params)
        
        entry_ids = set()
        for row in edges:
            entry_ids.add(row["from_entry_id"])
            entry_ids.add(row["to_entry_id"])

        if not entry_ids:
            return {"elements": {"nodes": [], "edges": []}}

        entries_query = """
            SELECT id, data->>'title' as title, metadata,
                   (SELECT name FROM content_types WHERE id = content_type_id) as type_name
            FROM content_entries
            WHERE id = ANY($1::text[])
        """
        entries = await conn.fetch(entries_query, list(entry_ids))

        nodes = []
        for row in entries:
            data = {
                "id": str(row["id"]),
                "label": row["title"],
                "contentType": row["type_name"],
            }
            if include_analytics and row["metadata"]:
                meta = json.loads(row["metadata"]) if isinstance(row["metadata"], str) else row["metadata"]
                graph_meta = meta.get("graph", {})
                data["pagerankScore"] = graph_meta.get("pagerankScore")
                data["communityId"] = graph_meta.get("communityId")
                data["betweennessScore"] = graph_meta.get("betweennessScore")

            nodes.append({"data": data})

        cy_edges = []
        for i, row in enumerate(edges):
            cy_edges.append({
                "data": {
                    "id": f"e{i}",
                    "source": str(row["from_entry_id"]),
                    "target": str(row["to_entry_id"]),
                    "edgeType": row["edge_type"],
                    "weight": row["weight"],
                }
            })

        return {
            "elements": {
                "nodes": nodes,
                "edges": cy_edges
            }
        }

    async def export_graphml(
        self,
        content_type: str | None,
        conn: asyncpg.Connection,
    ) -> str:
        """
        GraphML XML format \u2014 compatible with Gephi, yEd, Neo4j import.
        """
        G = await analytics_engine.build_networkx_graph(content_type, conn)  # noqa: N806
        
        if G.number_of_nodes() == 0:
            import networkx as nx
            return "".join(nx.generate_graphml(nx.DiGraph()))

        # Add node attributes
        entry_ids = list(G.nodes())
        entries_query = """
            SELECT id, data->>'title' as title, metadata,
                   (SELECT name FROM content_types WHERE id = content_type_id) as type_name
            FROM content_entries
            WHERE id = ANY($1::text[])
        """
        entries = await conn.fetch(entries_query, entry_ids)
        
        import networkx as nx
        for row in entries:
            node_id = str(row["id"])
            if node_id in G:
                nx.set_node_attributes(G, {node_id: {
                    "label": row["title"],
                    "contentType": row["type_name"]
                }})
                
                if row["metadata"]:
                    meta = json.loads(row["metadata"]) if isinstance(row["metadata"], str) else row["metadata"]
                    graph_meta = meta.get("graph", {})
                    if "pagerankScore" in graph_meta:
                        nx.set_node_attributes(G, {node_id: {"pagerankScore": graph_meta["pagerankScore"]}})
                    if "communityId" in graph_meta:
                        nx.set_node_attributes(G, {node_id: {"communityId": graph_meta["communityId"]}})

        # nx.generate_graphml returns an iterator of strings
        return "".join(nx.generate_graphml(G))


exporter = KnowledgeGraphExporter()
