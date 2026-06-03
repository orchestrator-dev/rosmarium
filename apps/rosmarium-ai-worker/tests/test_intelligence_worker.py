import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from rosmarium_ai_worker.workers.intelligence_worker import process_intelligence_job


@pytest.fixture
def mock_pool():
    mock = AsyncMock()
    conn_mock = AsyncMock()
    conn_mock.fetchrow = AsyncMock()
    conn_mock.execute = AsyncMock()
    
    class MockAcquire:
        async def __aenter__(self) -> AsyncMock:
            return conn_mock
        async def __aexit__(self, exc_type: object, exc_val: object, exc_tb: object) -> None:
            pass
            
    mock.acquire = MagicMock(return_value=MockAcquire())
    return mock, conn_mock

@pytest.fixture
def base_job():
    return {
        "contentEntryId": "123",
        "contentType": "article",
        "fields": [{"fieldName": "title", "text": "Hello World"}],
        "locale": "en",
        "candidateLabels": ["tech", "science"],
        "operations": ["tag", "ner", "summarize", "deduplicate"]
    }

@pytest.mark.asyncio
async def test_intelligence_worker_success(base_job, mock_pool):
    pool, conn = mock_pool
    
    # Setup deduplicate row return and content_types graph settings
    conn.fetchrow.side_effect = [
        {"embedding": [0.1, 0.2]},  # For deduplicate
        {"settings": json.dumps({"graph": {"enabled": True}})}  # For graph inference
    ]
    
    with patch("rosmarium_ai_worker.workers.intelligence_worker.get_pool", return_value=pool), \
         patch("rosmarium_ai_worker.workers.intelligence_worker.auto_tagger.tag_async", new_callable=AsyncMock) as tag_mock, \
         patch("rosmarium_ai_worker.workers.intelligence_worker.ner_extractor.extract_async", new_callable=AsyncMock) as ner_mock, \
         patch("rosmarium_ai_worker.workers.intelligence_worker.ner_extractor.to_dict", return_value={"ORG": ["Apple"]}), \
         patch("rosmarium_ai_worker.workers.intelligence_worker.content_summarizer.summarize", new_callable=AsyncMock) as sum_mock, \
         patch("rosmarium_ai_worker.workers.intelligence_worker.duplicate_detector.find_duplicates", new_callable=AsyncMock) as dedup_mock, \
         patch("rosmarium_ai_worker.workers.intelligence_worker.inference_engine.run_all", new_callable=AsyncMock) as graph_mock:
             
        tag_mock.return_value = []
        ner_mock.return_value = []
        
        sum_result_mock = MagicMock()
        sum_result_mock.summary = "Test summary"
        sum_result_mock.model_dump.return_value = {}
        sum_mock.return_value = sum_result_mock
        
        dedup_mock.return_value = []
        
        await process_intelligence_job(base_job)
        
        tag_mock.assert_called_once()
        ner_mock.assert_called_once()
        sum_mock.assert_called_once()
        dedup_mock.assert_called_once()
        graph_mock.assert_called_once()

@pytest.mark.asyncio
async def test_intelligence_worker_exceptions(base_job, mock_pool):
    pool, conn = mock_pool
    conn.fetchrow.side_effect = [
        Exception("DB Error deduplicate"),  # for deduplicate
        {"settings": json.dumps({"graph": {"enabled": True}})}  # for graph
    ]
    
    with patch("rosmarium_ai_worker.workers.intelligence_worker.get_pool", return_value=pool), \
         patch("rosmarium_ai_worker.workers.intelligence_worker.auto_tagger.tag_async", side_effect=ValueError("Tag Error")), \
         patch("rosmarium_ai_worker.workers.intelligence_worker.ner_extractor.extract_async", side_effect=ValueError("NER Error")), \
         patch("rosmarium_ai_worker.workers.intelligence_worker.content_summarizer.summarize", side_effect=ValueError("Sum Error")), \
         patch("rosmarium_ai_worker.workers.intelligence_worker.inference_engine.run_all", side_effect=ValueError("Graph Error")):
             
        # Should catch all exceptions and not crash
        await process_intelligence_job(base_job)
        
        # Verify it still attempts to update metadata since it might have partial results
        # Wait, if all fail, results is empty, so it doesn't execute UPDATE
        # Let's check call count of conn.execute
        conn.execute.assert_not_called()

@pytest.mark.asyncio
async def test_intelligence_worker_empty_text(mock_pool):
    job = {
        "contentEntryId": "123",
        "contentType": "article",
        "fields": [{"fieldName": "title", "text": "   "}],
        "locale": "en",
    }
    
    # Process should return early
    await process_intelligence_job(job)
