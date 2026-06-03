import pytest
from unittest.mock import AsyncMock
from rosmarium_ai_worker.graph.reference_inference import infer_from_references

@pytest.mark.asyncio
async def test_infer_from_references():
    mock_conn = AsyncMock()
    mock_conn.fetch.return_value = [
        {
            "id": "entry-2",
            "content_type_name": "article"
        }
    ]
    
    edges = await infer_from_references(
        entry_id="entry-1",
        content_type="article",
        text_content="Check out [[slug-1]] and /content/slug-2",
        conn=mock_conn
    )
    
    assert edges == 2  # one for slug-1, one for slug-2
    assert mock_conn.fetch.call_count == 2
    assert mock_conn.execute.call_count == 2

@pytest.mark.asyncio
async def test_infer_from_references_no_slugs():
    mock_conn = AsyncMock()
    edges = await infer_from_references(
        entry_id="entry-1",
        content_type="article",
        text_content="No slugs here",
        conn=mock_conn
    )
    assert edges == 0

@pytest.mark.asyncio
async def test_infer_from_references_exception():
    mock_conn = AsyncMock()
    mock_conn.fetch.return_value = [
        {
            "id": "entry-2",
            "content_type_name": "article"
        }
    ]
    mock_conn.execute.side_effect = Exception("DB error")
    
    edges = await infer_from_references(
        entry_id="entry-1",
        content_type="article",
        text_content="[[slug-1]]",
        conn=mock_conn
    )
    assert edges == 0
