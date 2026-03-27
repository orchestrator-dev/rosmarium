"""EmbeddingProvider abstract base class — all providers must implement this."""

from abc import ABC, abstractmethod


class EmbeddingProvider(ABC):
    """Abstract base class for embedding providers.

    All providers must implement embed(), health_check(), dimensions, and model_name.
    """

    @abstractmethod
    async def embed(self, texts: list[str]) -> list[list[float]]:
        """Embed a batch of texts and return their vector representations.

        Args:
            texts: List of text strings to embed.

        Returns:
            List of embedding vectors, one per input text.
        """
        ...

    async def embed_one(self, text: str) -> list[float]:
        """Embed a single text string — convenience wrapper around embed()."""
        results = await self.embed([text])
        return results[0]

    @abstractmethod
    async def health_check(self) -> bool:
        """Check if the provider is reachable and operational.

        Returns:
            True if healthy, False otherwise. Must never raise.
        """
        ...

    @property
    @abstractmethod
    def dimensions(self) -> int:
        """Return the dimensionality of the embedding vectors."""
        ...

    @property
    @abstractmethod
    def model_name(self) -> str:
        """Return the model identifier string."""
        ...
