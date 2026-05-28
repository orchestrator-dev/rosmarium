"""Tests for health and readiness endpoints."""

from fastapi.testclient import TestClient

from rosmarium_ai_worker.main import create_app


def _make_client() -> TestClient:
    """Create a test client with lifespan disabled."""
    app = create_app()
    return TestClient(app, raise_server_exceptions=False)


class TestHealthEndpoint:
    """Tests for GET /health."""

    def test_health_returns_ok(self) -> None:
        client = _make_client()
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["service"] == "rosmarium-ai-worker"

    def test_health_response_schema(self) -> None:
        client = _make_client()
        response = client.get("/health")
        data = response.json()
        assert set(data.keys()) == {"status", "service"}
