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

    async def embed_one_with_input_type(
        self, text: str, input_type: str = "search_document"
    ) -> list[float]:
        """Embed a single text with an explicit input_type hint.

        Providers that distinguish query vs document embeddings (e.g. Cohere)
        should override this method. The default falls back to embed_one().

        Args:
            text: Text string to embed.
            input_type: 'search_query' for query-time embeddings,
                        'search_document' for indexing embeddings.

        Returns:
            Embedding vector as a list of floats.
        """
        return await self.embed_one(text)

    async def embed_batch_with_input_type(
        self, texts: list[str], input_type: str = "search_document"
    ) -> list[list[float]]:
        """Embed a batch of texts with an explicit input_type hint.

        Providers that distinguish query vs document embeddings (e.g. Cohere)
        should override this method. The default falls back to embed().

        Args:
            texts: List of text strings to embed.
            input_type: 'search_query' for query-time embeddings,
                        'search_document' for indexing embeddings.

        Returns:
            List of embedding vectors, one per input text.
        """
        return await self.embed(texts)

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
