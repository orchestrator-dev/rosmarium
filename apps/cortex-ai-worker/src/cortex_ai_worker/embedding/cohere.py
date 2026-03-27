"""Cohere embedding provider."""

import time

import structlog

from ..config import settings
from .base import EmbeddingProvider

logger = structlog.get_logger(__name__)

# Known embedding dimensions for Cohere models
_KNOWN_DIMENSIONS: dict[str, int] = {
    "embed-english-v3.0": 1024,
    "embed-multilingual-v3.0": 1024,
    "embed-english-light-v3.0": 384,
    "embed-multilingual-light-v3.0": 384,
}


class CohereEmbeddingProvider(EmbeddingProvider):
    """Embedding provider using the Cohere API."""

    def __init__(self, api_key: str, model: str) -> None:
        self._api_key = api_key
        self._model = model
        # Import lazily so the package is only required when this provider is used
        import cohere

        self._client = cohere.AsyncClientV2(api_key=api_key)

    async def embed(
        self,
        texts: list[str],
        input_type: str = "search_document",
    ) -> list[list[float]]:
        """Embed texts via Cohere embeddings API.

        Args:
            texts: Texts to embed.
            input_type: 'search_document' for indexing, 'search_query' for queries.
        """
        start = time.monotonic()

        response = await self._client.embed(
            texts=texts,
            model=self._model,
            input_type=input_type,
            embedding_types=["float"],
        )

        latency_ms = int((time.monotonic() - start) * 1000)
        logger.info(
            "cohere_embed_complete",
            model=self._model,
            input_count=len(texts),
            input_type=input_type,
            latency_ms=latency_ms,
        )

        embeddings: list[list[float]] = [
            list(e) for e in response.embeddings.float_
        ]
        return embeddings

    async def health_check(self) -> bool:
        """Verify connectivity by embedding a short test string."""
        try:
            await self.embed(["health"], input_type="search_query")
            return True
        except Exception:
            logger.warning("cohere_health_check_failed", model=self._model)
            return False

    @property
    def dimensions(self) -> int:
        """Return dimensions for the configured model."""
        dim = _KNOWN_DIMENSIONS.get(self._model)
        return dim if dim is not None else settings.embedding_dimensions

    @property
    def model_name(self) -> str:
        return self._model
