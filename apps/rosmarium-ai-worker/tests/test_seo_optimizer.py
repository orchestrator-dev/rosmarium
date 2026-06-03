import pytest
from unittest.mock import patch, AsyncMock
from rosmarium_ai_worker.generation.seo_optimizer import SEOOptimizer

@pytest.fixture
def seo():
    return SEOOptimizer()

@pytest.mark.asyncio
async def test_optimize(seo):
    mock_post = AsyncMock()
    mock_post.return_value.json = lambda: {"response": '{"title":"t","meta_description":"d","headings":["h1"]}'}
    mock_post.return_value.raise_for_status = lambda: None

    with patch("httpx.AsyncClient.post", mock_post):
        res = await seo.optimize("article text", "my keyword")
        assert res.title == "t"
        assert res.meta_description == "d"
        assert "h1" in res.headings

@pytest.mark.asyncio
async def test_generate_alt_text(seo):
    mock_post = AsyncMock()
    mock_post.return_value.json = lambda: {"response": "mock alt text"}
    mock_post.return_value.raise_for_status = lambda: None

    with patch("httpx.AsyncClient.post", mock_post):
        res = await seo.generate_alt_text("some image context")
        assert res == "mock alt text"
