import pytest
from unittest.mock import patch
from fastapi.responses import StreamingResponse
from rosmarium_ai_worker.generation.rewriter import ContentRewriter

@pytest.fixture
def rewriter():
    return ContentRewriter()

@pytest.mark.asyncio
async def test_rewrite_stream(rewriter):
    class MockResponse:
        def raise_for_status(self):
            pass
            
        async def aiter_lines(self):
            import json
            yield json.dumps({"response": "formal "})
            yield json.dumps({"response": "text"})
            yield json.dumps({"done": True})

    class MockStreamContext:
        async def __aenter__(self):
            return MockResponse()
        async def __aexit__(self, exc_type, exc, tb):
            pass

    class MockClientContext:
        async def __aenter__(self):
            return self
        async def __aexit__(self, exc_type, exc, tb):
            pass
        def stream(self, *args, **kwargs):
            return MockStreamContext()

    with patch("httpx.AsyncClient", return_value=MockClientContext()):
        # Note: the second argument must be from Literal["professional", "casual", "shorter", "longer"]
        res = await rewriter.rewrite_stream("original", "professional")
        assert isinstance(res, StreamingResponse)
        
        chunks = []
        async for chunk in res.body_iterator:
            chunks.append(chunk)
            
        assert len(chunks) == 3
        assert "formal" in chunks[0]
        assert "text" in chunks[1]
        assert "[DONE]" in chunks[2]
