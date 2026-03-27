"""OpenAI embedding provider — production option."""

import asyncio
import time

import structlog

from ..config import settings
from .base import EmbeddingProvider

logger = structlog.get_logger(__name__)

# Known embedding dimensions for OpenAI models
_KNOWN_DIMENSIONS: dict[str, int] = {
    "text-embedding-3-small": 1536,
    "text-embedding-3-large": 3072,
    "text-embedding-ada-002": 1536,
}

# OpenAI batch limit per request
_OPENAI_BATCH_LIMIT = 2048


class OpenAIEmbeddingProvider(EmbeddingProvider):
    """Embedding provider using the OpenAI API."""

    def __init__(self, api_key: str, model: str) -> None:
        self._api_key = api_key
        self._model = model
        # Import lazily so the package is only required when this provider is used
        from openai import AsyncOpenAI

        self._client = AsyncOpenAI(api_key=api_key)

    async def embed(self, texts: list[str]) -> list[list[float]]:
        """Embed texts via OpenAI embeddings API.

        Chunks into batches of 2048 and runs them in parallel.
        """
        start = time.monotonic()

        # Split into batches
        batches = [
            texts[i : i + _OPENAI_BATCH_LIMIT]
            for i in range(0, len(texts), _OPENAI_BATCH_LIMIT)
        ]

        async def _embed_batch(batch: list[str]) -> list[list[float]]:
            response = await self._client.embeddings.create(
                model=self._model,
                input=batch,
            )
            return [item.embedding for item in response.data]

        # Run batches in parallel
        batch_results = await asyncio.gather(*[_embed_batch(b) for b in batches])

        # Flatten results maintaining order
        all_embeddings: list[list[float]] = []
        total_tokens = 0
        for result in batch_results:
            all_embeddings.extend(result)

        latency_ms = int((time.monotonic() - start) * 1000)
        logger.info(
            "openai_embed_complete",
            model=self._model,
            input_count=len(texts),
            batch_count=len(batches),
            total_tokens=total_tokens,
            latency_ms=latency_ms,
        )

        return all_embeddings

    async def health_check(self) -> bool:
        """Verify connectivity by embedding a short test string."""
        try:
            await self.embed(["health"])
            return True
        except Exception:
            logger.warning("openai_health_check_failed", model=self._model)
            return False

    @property
    def dimensions(self) -> int:
        """Return dimensions for the configured model."""
        dim = _KNOWN_DIMENSIONS.get(self._model)
        return dim if dim is not None else settings.embedding_dimensions

    @property
    def model_name(self) -> str:
        return self._model
