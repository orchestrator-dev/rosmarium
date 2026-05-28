"""Ollama embedding provider — local, default for development."""

import time

import httpx
import structlog

from ..config import settings
from .base import EmbeddingProvider

logger = structlog.get_logger(__name__)

# Known embedding dimensions for popular Ollama models
_KNOWN_DIMENSIONS: dict[str, int] = {
    "nomic-embed-text": 768,
    "mxbai-embed-large": 1024,
    "all-minilm": 384,
    "snowflake-arctic-embed": 1024,
}


class OllamaEmbeddingProvider(EmbeddingProvider):
    """Embedding provider using a local Ollama server."""

    def __init__(self, base_url: str, model: str) -> None:
        self._base_url = base_url.rstrip("/")
        self._model = model
        self._client = httpx.AsyncClient(base_url=self._base_url, timeout=120.0)

    async def embed(self, texts: list[str]) -> list[list[float]]:
        """Embed texts via Ollama's /api/embed endpoint.

        Sends all texts in a single batch request.
        """
        start = time.monotonic()

        response = await self._client.post(
            "/api/embed",
            json={"model": self._model, "input": texts},
        )
        response.raise_for_status()
        data = response.json()

        latency_ms = int((time.monotonic() - start) * 1000)
        logger.info(
            "ollama_embed_complete",
            model=self._model,
            input_count=len(texts),
            latency_ms=latency_ms,
        )

        embeddings: list[list[float]] = data["embeddings"]
        return embeddings

    async def health_check(self) -> bool:
        """Check that Ollama is running and the configured model is available."""
        try:
            response = await self._client.get("/api/tags")
            response.raise_for_status()
            data = response.json()
            available_models = [m.get("name", "") for m in data.get("models", [])]
            # Ollama model names can include :latest suffix
            model_found = any(
                self._model in name for name in available_models
            )
            if not model_found:
                logger.warning(
                    "ollama_model_not_found",
                    model=self._model,
                    available=available_models,
                )
            return model_found
        except Exception:
            logger.warning("ollama_health_check_failed", base_url=self._base_url)
            return False

    @property
    def dimensions(self) -> int:
        """Return dimensions for the configured model."""
        dim = _KNOWN_DIMENSIONS.get(self._model)
        return dim if dim is not None else settings.embedding_dimensions

    @property
    def model_name(self) -> str:
        return self._model
