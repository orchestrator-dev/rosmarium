from rosmarium_ai_worker.config import settings
import pytest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient
from rosmarium_ai_worker.main import create_app

def _make_client():
    app = create_app()
    return TestClient(app, raise_server_exceptions=False)

def test_rag_retrieve():
    client = _make_client()
    
    with patch("rosmarium_ai_worker.api.routes.rag.RAGPipeline") as mock_pipeline_cls:
        mock_pipeline = mock_pipeline_cls.return_value
        mock_pipeline.query = AsyncMock(return_value={
            "answer": "This is a mocked answer",
            "sources": []
        })
        
        response = client.post(
            "/rag/retrieve",
            json={
                "query": "What is the answer?",
                "contentType": "article",
                "topK": 3
            },
            headers={"X-Tenant-Id": "tenant-1", "X-Worker-Secret": settings.worker_secret}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["answer"] == "This is a mocked answer"

def test_rag_retrieve_stream():
    client = _make_client()
    
    with patch("rosmarium_ai_worker.api.routes.rag.RAGPipeline") as mock_pipeline_cls:
        mock_pipeline = mock_pipeline_cls.return_value
        
        async def mock_stream_generator(*args, **kwargs):
            yield "data: {\"chunk\": \"This \"}\n\n"
            yield "data: {\"chunk\": \"is \"}\n\n"
            yield "data: {\"chunk\": \"mocked\"}\n\n"
            
        mock_pipeline.stream_query = mock_stream_generator
        
        response = client.post(
            "/rag/retrieve/stream",
            json={
                "query": "What is the answer?",
                "contentType": "article"
            },
            headers={"X-Tenant-Id": "tenant-1", "X-Worker-Secret": settings.worker_secret}
        )
        
        assert response.status_code == 200
        # It's an SSE stream, we can check the content
        assert "This" in response.text
