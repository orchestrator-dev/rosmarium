import pytest
import os
import json
from datetime import datetime
from rosmarium_ai_worker.ingestor.models import IngestorConfig
from rosmarium_ai_worker.ingestor.extractors import ExtractorFactory

@pytest.mark.asyncio
async def test_file_extractor_json(tmp_path):
    test_file = tmp_path / "test.json"
    data = [{"id": 1, "name": "Item 1"}, {"id": 2, "name": "Item 2"}]
    test_file.write_text(json.dumps(data))
    
    config = IngestorConfig(
        jobId="test-job",
        name="test-job",
        source={
            "type": "file",
            "path": str(test_file),
            "format": "json"
        },
        targetType="article",
        importAs="draft"
    )
    
    extractor = ExtractorFactory.get_extractor(config)
    results = []
    async for page in extractor.extract():
        results.append(page)
        
    assert len(results) == 2
    assert "Item 1" in results[0].markdown
    assert "Item 2" in results[1].markdown
    assert results[0].url.startswith("file://")
