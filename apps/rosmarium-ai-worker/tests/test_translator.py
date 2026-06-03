import pytest
from unittest.mock import patch, AsyncMock
from rosmarium_ai_worker.translation.translator import AITranslator

@pytest.fixture
def translator():
    return AITranslator()

@pytest.mark.asyncio
async def test_translate(translator):
    mock_post = AsyncMock()
    mock_post.return_value.json = lambda: {"response": "translated text"}
    mock_post.return_value.raise_for_status = lambda: None

    with patch("httpx.AsyncClient.post", mock_post):
        res = await translator.translate("hello", "es")
        assert res == "translated text"

@pytest.mark.asyncio
async def test_translate_with_glossary(translator):
    mock_post = AsyncMock()
    mock_post.return_value.json = lambda: {"response": "translated with glossary"}
    mock_post.return_value.raise_for_status = lambda: None

    with patch("httpx.AsyncClient.post", mock_post):
        with patch("rosmarium_ai_worker.translation.glossary.glossary_manager.get_rules", return_value={"hello": "hola"}):
            res = await translator.translate("hello", "es", "tenant-1")
            assert res == "translated with glossary"

@pytest.mark.asyncio
async def test_translate_exception(translator):
    mock_post = AsyncMock(side_effect=Exception("API Error"))

    with patch("httpx.AsyncClient.post", mock_post):
        with pytest.raises(Exception):
            await translator.translate("hello", "es")
