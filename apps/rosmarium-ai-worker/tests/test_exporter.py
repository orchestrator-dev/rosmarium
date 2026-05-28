"""Unit tests for the knowledge graph exporter."""

from unittest.mock import AsyncMock, MagicMock

import pytest

from rosmarium_ai_worker.graph.exporter import KnowledgeGraphExporter


@pytest.fixture
def exporter() -> KnowledgeGraphExporter:
    return KnowledgeGraphExporter()

@pytest.fixture
def mock_conn() -> MagicMock:
    conn = AsyncMock()
    return conn

@pytest.mark.asyncio
async def test_export_json_ld(exporter: KnowledgeGraphExporter, mock_conn: MagicMock) -> None:
    async def mock_fetch(query, *args):
        if "graph_edges" in query:
            return [{"from_entry_id": "A", "to_entry_id": "B", "edge_type": "relatedTo", "weight": 1.0, "is_accepted": "accepted"}]
        else:
            return [
                {"id": "A", "content_type": "article", "title": "Article A", "type_name": "article", "published_at": None, "metadata": "{\"graph\": {\"pagerankScore\": 0.5}}"},
                {"id": "B", "content_type": "article", "title": "Article B", "type_name": "article", "published_at": None, "metadata": "{}"},
            ]
    mock_conn.fetch.side_effect = mock_fetch

    data = await exporter.export_json_ld(None, mock_conn)
    assert "@context" in data
    assert "@graph" in data
    assert len(data["@graph"]) == 2
    
    node_a = next(n for n in data["@graph"] if n["@id"] == "rosmarium:entry/A")
    assert node_a["@type"] == "schema:Article"
    assert node_a["rosmarium:relatedTo"][0]["@id"] == "rosmarium:entry/B"

@pytest.mark.asyncio
async def test_export_rdf(exporter: KnowledgeGraphExporter, mock_conn: MagicMock) -> None:
    async def mock_fetch(query, *args):
        if "graph_edges" in query:
            return [{"from_entry_id": "A", "to_entry_id": "B", "edge_type": "relatedTo", "weight": 1.0, "is_accepted": "accepted"}]
        else:
            return [
                {"id": "A", "content_type": "article", "title": "Article A", "type_name": "article", "published_at": None, "metadata": "{\"graph\": {\"pagerankScore\": 0.5}}"},
                {"id": "B", "content_type": "article", "title": "Article B", "type_name": "article", "published_at": None, "metadata": "{}"},
            ]
    mock_conn.fetch.side_effect = mock_fetch

    result = await exporter.export_rdf_turtle(None, mock_conn)
    assert "vocab#entry/A" in result
    assert "vocab#entry/B" in result

@pytest.mark.asyncio
async def test_export_cytoscape(exporter: KnowledgeGraphExporter, mock_conn: MagicMock) -> None:
    async def mock_fetch(query, *args):
        if "graph_edges" in query:
            return [{"from_entry_id": "A", "to_entry_id": "B", "edge_type": "relatedTo", "weight": 1.0, "is_accepted": "accepted", "id": "edge-1"}]
        else:
            return [
                {"id": "A", "content_type": "article", "title": "Article A", "type_name": "article", "published_at": None, "metadata": "{\"graph\": {\"pagerankScore\": 0.5}}"},
                {"id": "B", "content_type": "article", "title": "Article B", "type_name": "article", "published_at": None, "metadata": "{}"},
            ]
    mock_conn.fetch.side_effect = mock_fetch

    data = await exporter.export_cytoscape(None, mock_conn, True)
    assert "elements" in data
    nodes = data["elements"]["nodes"]
    edges = data["elements"]["edges"]
    assert len(nodes) == 2
    assert len(edges) == 1
    node_a = next(item for item in nodes if item["data"].get("id") == "A")
    assert node_a["data"]["pagerankScore"] == 0.5
    edge = next(item for item in edges if item["data"].get("source") == "A")
    assert edge["data"]["target"] == "B"
    assert edge["data"]["edgeType"] == "relatedTo"
