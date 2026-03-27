"""Shared pytest fixtures for rosmarium-ai-worker tests."""

from unittest.mock import AsyncMock, MagicMock

import pytest

from rosmarium_ai_worker.embedding.base import EmbeddingProvider


class MockEmbeddingProvider(EmbeddingProvider):
    """Mock embedding provider for tests — never calls real APIs."""

    def __init__(self, dimensions: int = 768) -> None:
        self._dimensions = dimensions
        self._model = "mock-embed-test"
        self.embed_calls: list[list[str]] = []

    async def embed(self, texts: list[str]) -> list[list[float]]:
        self.embed_calls.append(texts)
        return [[0.1] * self._dimensions for _ in texts]

    async def health_check(self) -> bool:
        return True

    @property
    def dimensions(self) -> int:
        return self._dimensions

    @property
    def model_name(self) -> str:
        return self._model


@pytest.fixture
def mock_provider() -> MockEmbeddingProvider:
    """Return a mock embedding provider."""
    return MockEmbeddingProvider()


@pytest.fixture
def mock_pool() -> AsyncMock:
    """Return a mock asyncpg connection pool."""
    pool = AsyncMock()
    conn = AsyncMock()
    conn.execute = AsyncMock(return_value="SELECT 1")
    conn.fetch = AsyncMock(return_value=[])
    conn.fetchrow = AsyncMock(return_value=None)
    conn.executemany = AsyncMock()

    # Make pool.acquire() work as an async context manager
    acquire_cm = AsyncMock()
    acquire_cm.__aenter__ = AsyncMock(return_value=conn)
    acquire_cm.__aexit__ = AsyncMock(return_value=None)
    pool.acquire = MagicMock(return_value=acquire_cm)

    return pool


@pytest.fixture
def mock_conn(mock_pool: AsyncMock) -> AsyncMock:
    """Return the mock connection from the mock pool."""
    return mock_pool.acquire.return_value.__aenter__.return_value
