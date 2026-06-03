import json
import pytest
from unittest.mock import patch, AsyncMock
from fastapi.responses import StreamingResponse
from rosmarium_ai_worker.generation.generator import ContentGenerator

@pytest.fixture
def generator():
    return ContentGenerator()

def test_build_prompt(generator):
    assert generator._build_prompt("test", None) == "test"
    
    ctx = {"key": "val"}
    prompt = generator._build_prompt("test task", ctx)
    assert "Context information:" in prompt
    assert "key" in prompt
    assert "val" in prompt
    assert "Task:\ntest task" in prompt

@pytest.mark.asyncio
async def test_generate_sync(generator):
    mock_post = AsyncMock()
    mock_post.return_value.json = lambda: {"response": "mock generated content"}
    mock_post.return_value.raise_for_status = lambda: None

    with patch("httpx.AsyncClient.post", mock_post):
        res = await generator.generate("test prompt")
        assert res == "mock generated content"

@pytest.mark.asyncio
async def test_generate_sync_exception(generator):
    mock_post = AsyncMock(side_effect=Exception("HTTP error"))

    with patch("httpx.AsyncClient.post", mock_post):
        with pytest.raises(Exception):
            await generator.generate("test prompt")

@pytest.mark.asyncio
async def test_generate_stream(generator):
    # Mocking httpx.AsyncClient.stream is trickier.
    # We can mock the httpx.AsyncClient class to return a client that has a stream method.
    
    class MockResponse:
        def raise_for_status(self):
            pass
            
        async def aiter_lines(self):
            yield json.dumps({"response": "hello "})
            yield json.dumps({"response": "world"})
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
        res = await generator.generate_stream("test stream")
        assert isinstance(res, StreamingResponse)
        
        # Read the async generator
        chunks = []
        async for chunk in res.body_iterator:
            chunks.append(chunk)
            
        # Assuming yield returns strings like "data: { ... }\n\n"
        assert len(chunks) == 3 # two chunks, one [DONE]
        assert "hello" in chunks[0]
        assert "world" in chunks[1]
        assert "[DONE]" in chunks[2]

@pytest.mark.asyncio
async def test_generate_stream_exception(generator):
    class MockClientContextException:
        async def __aenter__(self):
            return self
        async def __aexit__(self, exc_type, exc, tb):
            pass
        def stream(self, *args, **kwargs):
            raise Exception("Stream error")

    with patch("httpx.AsyncClient", return_value=MockClientContextException()):
        res = await generator.generate_stream("test stream error")
        
        chunks = []
        async for chunk in res.body_iterator:
            chunks.append(chunk)
            
        assert len(chunks) == 2
        assert "error" in chunks[0]
        assert "[DONE]" in chunks[1]
