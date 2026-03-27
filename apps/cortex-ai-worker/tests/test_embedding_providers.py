"""Tests for embedding providers."""


import pytest

from rosmarium_ai_worker.embedding.base import EmbeddingProvider
from rosmarium_ai_worker.embedding.ollama import OllamaEmbeddingProvider
from tests.conftest import MockEmbeddingProvider


class TestEmbeddingProviderABC:
    """Tests for the EmbeddingProvider abstract base class."""

    def test_cannot_instantiate_abc(self) -> None:
        with pytest.raises(TypeError):
            EmbeddingProvider()  # type: ignore[abstract]

    async def test_embed_one_delegates_to_embed(self) -> None:
        provider = MockEmbeddingProvider(dimensions=768)
        result = await provider.embed_one("hello")
        assert len(result) == 768
        assert provider.embed_calls == [["hello"]]


class TestOllamaEmbeddingProvider:
    """Tests for the Ollama embedding provider."""

    def test_known_model_dimensions(self) -> None:
        provider = OllamaEmbeddingProvider(
            base_url="http://localhost:11434",
            model="nomic-embed-text",
        )
        assert provider.dimensions == 768

    def test_unknown_model_falls_back_to_settings(self) -> None:
        provider = OllamaEmbeddingProvider(
            base_url="http://localhost:11434",
            model="custom-model",
        )
        # Falls back to settings.embedding_dimensions (768 default)
        assert isinstance(provider.dimensions, int)

    def test_model_name_property(self) -> None:
        provider = OllamaEmbeddingProvider(
            base_url="http://localhost:11434",
            model="nomic-embed-text",
        )
        assert provider.model_name == "nomic-embed-text"

    async def test_health_check_returns_false_on_connection_error(self) -> None:
        provider = OllamaEmbeddingProvider(
            base_url="http://localhost:99999",
            model="nomic-embed-text",
        )
        result = await provider.health_check()
        assert result is False


class TestMockProvider:
    """Tests for the mock provider used in other tests."""

    async def test_mock_embed(self) -> None:
        provider = MockEmbeddingProvider(dimensions=384)
        result = await provider.embed(["hello", "world"])
        assert len(result) == 2
        assert len(result[0]) == 384

    async def test_mock_health_check(self) -> None:
        provider = MockEmbeddingProvider()
        assert await provider.health_check() is True
