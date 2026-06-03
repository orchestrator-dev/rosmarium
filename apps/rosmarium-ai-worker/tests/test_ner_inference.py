import pytest
from unittest.mock import AsyncMock
from rosmarium_ai_worker.graph.ner_inference import infer_from_ner

@pytest.mark.asyncio
async def test_infer_from_ner():
    mock_conn = AsyncMock()
    mock_conn.fetchrow.return_value = {"id": "entity-1"}
    
    # Simulate finding another entry that mentions the same entity
    mock_conn.fetch.return_value = [
        {
            "entry_id": "other-entry-1",
            "content_type_id": "ct-1",
            "content_type_name": "article"
        }
    ]
    
    ner_results = {
        "PERSON": ["Alice"],
        "ORG": ["  ", "ACME"]  # test empty string skipping
    }
    
    edges_created = await infer_from_ner(
        entry_id="source-entry",
        content_type="article",
        ner_results=ner_results,
        conn=mock_conn
    )
    
    assert edges_created == 2  # one for Alice, one for ACME
    assert mock_conn.fetchrow.call_count == 2
    assert mock_conn.execute.call_count == 4  # 2 inserts for mention, 2 inserts for edge

@pytest.mark.asyncio
async def test_infer_from_ner_exception():
    mock_conn = AsyncMock()
    mock_conn.fetchrow.return_value = {"id": "entity-1"}
    mock_conn.fetch.return_value = [
        {
            "entry_id": "other-entry-1",
            "content_type_id": "ct-1",
            "content_type_name": "article"
        }
    ]
    
    # Make edge creation fail to trigger except block
    def side_effect(*args, **kwargs):
        if "INSERT INTO graph_edges" in args[0]:
            raise Exception("DB error")
        return None
        
    mock_conn.execute.side_effect = side_effect
    
    ner_results = {"PERSON": ["Alice"]}
    
    edges_created = await infer_from_ner(
        entry_id="source-entry",
        content_type="article",
        ner_results=ner_results,
        conn=mock_conn
    )
    
    assert edges_created == 0
