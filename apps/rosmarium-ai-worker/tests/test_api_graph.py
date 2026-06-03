from rosmarium_ai_worker.config import settings
import pytest
import json
from unittest.mock import patch, AsyncMock, MagicMock
from fastapi.testclient import TestClient
from rosmarium_ai_worker.main import create_app

def _make_client():
    app = create_app()
    return TestClient(app, raise_server_exceptions=False)

def test_compute_analytics():
    client = _make_client()
    with patch("rosmarium_ai_worker.api.routes.graph.aioredis.from_url") as mock_redis:
        mock_redis_instance = AsyncMock()
        mock_redis.return_value = mock_redis_instance
        
        response = client.post(
            "/graph/analytics/compute",
            json={"contentType": "article"},
            headers={"X-Worker-Secret": settings.worker_secret}
        )
        assert response.status_code == 202

def test_get_entry_analytics():
    client = _make_client()
    with patch("rosmarium_ai_worker.api.routes.graph.get_pool") as mock_pool:
        mock_conn = AsyncMock()
        mock_conn.fetchrow.return_value = {"metadata": json.dumps({"graph": {"degree": 5}})}
        
        mock_pool_instance = AsyncMock()
        # Mock async with pool.acquire() as conn
        mock_pool_instance.acquire.return_value.__aenter__.return_value = mock_conn
        mock_pool.return_value = mock_pool_instance
        
        response = client.get(
            "/graph/analytics/entry-123",
            headers={"X-Worker-Secret": settings.worker_secret}
        )
        assert response.status_code == 200
        assert response.json()["degree"] == 5

def test_get_entry_analytics_404():
    client = _make_client()
    with patch("rosmarium_ai_worker.api.routes.graph.get_pool") as mock_pool:
        mock_conn = AsyncMock()
        mock_conn.fetchrow.return_value = None
        
        mock_pool_instance = AsyncMock()
        mock_pool_instance.acquire.return_value.__aenter__.return_value = mock_conn
        mock_pool.return_value = mock_pool_instance
        
        response = client.get(
            "/graph/analytics/entry-404",
            headers={"X-Worker-Secret": settings.worker_secret}
        )
        assert response.status_code == 404

def test_export_graph():
    client = _make_client()
    with patch("rosmarium_ai_worker.api.routes.graph.get_pool") as mock_pool, \
         patch("rosmarium_ai_worker.api.routes.graph.exporter") as mock_exporter:
         
        mock_conn = AsyncMock()
        mock_pool_instance = AsyncMock()
        mock_pool_instance.acquire.return_value.__aenter__.return_value = mock_conn
        mock_pool.return_value = mock_pool_instance
        
        mock_exporter.export_json_ld.return_value = {"nodes": []}
        
        response = client.get(
            "/graph/export?format=json-ld",
            headers={"X-Worker-Secret": settings.worker_secret}
        )
        assert response.status_code == 200
        
        mock_exporter.export_rdf_turtle.return_value = "turtle"
        response = client.get(
            "/graph/export?format=rdf",
            headers={"X-Worker-Secret": settings.worker_secret}
        )
        assert response.status_code == 200
        
        mock_exporter.export_cytoscape.return_value = {"elements": []}
        response = client.get(
            "/graph/export?format=cytoscape",
            headers={"X-Worker-Secret": settings.worker_secret}
        )
        assert response.status_code == 200
        
        mock_exporter.export_graphml.return_value = "<graphml></graphml>"
        response = client.get(
            "/graph/export?format=graphml",
            headers={"X-Worker-Secret": settings.worker_secret}
        )
        assert response.status_code == 200
        
        response = client.get(
            "/graph/export?format=invalid",
            headers={"X-Worker-Secret": settings.worker_secret}
        )
        assert response.status_code == 400
