"""Shared pytest fixtures for cortex-ai-worker tests."""

import sys
import types
from unittest.mock import AsyncMock, MagicMock

import pytest

from cortex_ai_worker.embedding.base import EmbeddingProvider


# ---------------------------------------------------------------------------
# spaCy stub — installed before any test module is imported so that
# `import spacy` inside sentence.py / ner.py succeeds without the real package.
# ---------------------------------------------------------------------------

def _install_spacy_stub() -> None:
    if "spacy" in sys.modules:
        return

    spacy_stub = types.ModuleType("spacy")

    # Minimal Language stub
    class _Language:
        pipe_names: list[str] = []

        def __call__(self, text: str) -> MagicMock:  # noqa: ANN001
            return MagicMock(sents=iter([]))

        def add_pipe(self, name: str) -> None:  # noqa: ANN001
            self.pipe_names.append(name)

    def _spacy_load(model: str, **kwargs: object) -> _Language:  # type: ignore[return]
        """Raise OSError for real model names so skip guards work correctly."""
        if model in ("en_core_web_sm", "en_core_web_md", "en_core_web_lg"):
            raise OSError(f"[E050] Can't find model '{model}'")
        return _Language()

    spacy_stub.load = _spacy_load  # type: ignore[attr-defined]

    # language sub-module (imported by sentence.py as `from spacy.language import Language`)
    language_mod = types.ModuleType("spacy.language")
    language_mod.Language = _Language  # type: ignore[attr-defined]

    sys.modules["spacy"] = spacy_stub
    sys.modules["spacy.language"] = language_mod


_install_spacy_stub()



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
