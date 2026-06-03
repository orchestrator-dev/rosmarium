import pytest
from unittest.mock import AsyncMock
from rosmarium_ai_worker.graph.similarity_inference import infer_from_similarity

@pytest.mark.asyncio
async def test_infer_from_similarity():
    mock_conn = AsyncMock()
    # Source row
    mock_conn.fetchrow.return_value = {"embedding": "[0.1, 0.2]"}
    
    # Similar rows
    mock_conn.fetch.return_value = [
        {
            "content_entry_id": "other-1",
            "content_type_id": "ct-1",
            "content_type_name": "article",
            "similarity": 0.95
        }
    ]
    
    edges = await infer_from_similarity(
        entry_id="source-1",
        content_type="article",
        threshold=0.8,
        max_edges=5,
        conn=mock_conn
    )
    
    assert edges == 1
    assert mock_conn.fetchrow.call_count == 1
    assert mock_conn.fetch.call_count == 1
    assert mock_conn.execute.call_count == 2  # Bidirectional edge

@pytest.mark.asyncio
async def test_infer_from_similarity_no_source():
    mock_conn = AsyncMock()
    mock_conn.fetchrow.return_value = None
    
    edges = await infer_from_similarity(
        entry_id="source-1",
        content_type="article",
        threshold=0.8,
        max_edges=5,
        conn=mock_conn
    )
    
    assert edges == 0
    assert mock_conn.fetch.call_count == 0

@pytest.mark.asyncio
async def test_infer_from_similarity_exception():
    mock_conn = AsyncMock()
    mock_conn.fetchrow.return_value = {"embedding": "[0.1, 0.2]"}
    mock_conn.fetch.return_value = [
        {
            "content_entry_id": "other-1",
            "content_type_id": "ct-1",
            "content_type_name": "article",
            "similarity": 0.95
        }
    ]
    
    mock_conn.execute.side_effect = Exception("DB Error")
    
    edges = await infer_from_similarity(
        entry_id="source-1",
        content_type="article",
        threshold=0.8,
        max_edges=5,
        conn=mock_conn
    )
    
    assert edges == 0
