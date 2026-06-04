"""Local embedding provider using sentence-transformers (PyTorch).

Used as a reliable fallback when external API or Ollama is not available.
"""

import time
import structlog

from sentence_transformers import SentenceTransformer
from .base import EmbeddingProvider

logger = structlog.get_logger(__name__)

class LocalEmbeddingProvider(EmbeddingProvider):
    """Embedding provider using local sentence-transformers model."""

    def __init__(self, model_name: str = "all-MiniLM-L6-v2") -> None:
        self._model_name = model_name
        self._model = None
        self._dimensions = 384  # all-MiniLM-L6-v2 default

    def _get_model(self) -> SentenceTransformer:
        if self._model is None:
            logger.info("loading_local_embedding_model", model=self._model_name)
            self._model = SentenceTransformer(self._model_name)
            # Find dimensions by embedding a dummy text
            dummy = self._model.encode(["test"])
            self._dimensions = len(dummy[0])
            logger.info("local_embedding_model_loaded", model=self._model_name, dimensions=self._dimensions)
        return self._model

    async def embed(self, texts: list[str]) -> list[list[float]]:
        start = time.monotonic()
        
        # sentence-transformers encode is blocking, but for small batches in a worker it's usually acceptable,
        # or we could use asyncio.to_thread.
        import asyncio
        model = self._get_model()
        
        # encode returns numpy array, convert to list of floats
        embeddings_np = await asyncio.to_thread(model.encode, texts, show_progress_bar=False)
        embeddings = [arr.tolist() for arr in embeddings_np]

        latency_ms = int((time.monotonic() - start) * 1000)
        logger.info(
            "local_embed_complete",
            model=self._model_name,
            input_count=len(texts),
            latency_ms=latency_ms,
        )
        return embeddings

    async def health_check(self) -> bool:
        """Check if model can be loaded."""
        try:
            self._get_model()
            return True
        except Exception as e:
            logger.error("local_embedding_health_check_failed", error=str(e))
            return False

    @property
    def dimensions(self) -> int:
        return self._dimensions

    @property
    def model_name(self) -> str:
        return self._model_name
