"""Unit tests for the graph analytics engine."""

from unittest.mock import AsyncMock, MagicMock

import networkx as nx
import pytest

from cortex_ai_worker.graph.analytics import GraphAnalyticsEngine


@pytest.fixture
def engine() -> GraphAnalyticsEngine:
    return GraphAnalyticsEngine()

@pytest.fixture
def mock_conn() -> MagicMock:
    conn = AsyncMock()
    conn.fetch.return_value = [
        {"from_entry_id": "A", "to_entry_id": "B", "weight": 1.0, "edge_type": "relatedTo"},
        {"from_entry_id": "B", "to_entry_id": "C", "weight": 0.5, "edge_type": "relatedTo"},
        {"from_entry_id": "C", "to_entry_id": "A", "weight": 2.0, "edge_type": "relatedTo"},
    ]
    return conn

@pytest.mark.asyncio
async def test_builds_graph(engine: GraphAnalyticsEngine, mock_conn: MagicMock) -> None:
    G = await engine.build_networkx_graph(None, mock_conn)
    assert isinstance(G, nx.DiGraph)
    assert set(G.nodes) == {"A", "B", "C"}
    assert G.edges["A", "B"]["weight"] == 1.0

@pytest.mark.asyncio
async def test_compute_all_generates_analytics(engine: GraphAnalyticsEngine, mock_conn: MagicMock) -> None:
    results = await engine.compute_analytics(None, mock_conn)
    
    assert len(results) == 3
    node_a = next(r for r in results if r.entry_id == "A")
    assert hasattr(node_a, "pagerank_score")
    assert hasattr(node_a, "community_id")
    assert node_a.degree_out == 1
    assert node_a.degree_in == 1

@pytest.mark.asyncio
async def test_write_analytics_results(engine: GraphAnalyticsEngine, mock_conn: MagicMock) -> None:
    from cortex_ai_worker.graph.analytics import NodeAnalytics
    results = [
        NodeAnalytics("A", 0.1, 0.2, 1, 0.3, 0.4, 5, 3, 8)
    ]
    await engine.write_analytics_results(results, mock_conn)
    mock_conn.executemany.assert_called_once()
