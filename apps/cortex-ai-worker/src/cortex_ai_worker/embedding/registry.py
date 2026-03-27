"""Embedding provider registry — singleton init and access."""

import structlog

from ..config import settings
from .base import EmbeddingProvider
from .cohere import CohereEmbeddingProvider
from .ollama import OllamaEmbeddingProvider
from .openai import OpenAIEmbeddingProvider

logger = structlog.get_logger(__name__)

_provider: EmbeddingProvider | None = None


async def init_embedding_provider() -> None:
    """Initialise the embedding provider based on settings."""
    global _provider

    match settings.embedding_provider:
        case "ollama":
            _provider = OllamaEmbeddingProvider(
                base_url=settings.ollama_base_url,
                model=settings.embedding_model,
            )
        case "openai" | "openai-compatible":
            if not settings.openai_api_key:
                raise ValueError("OPENAI_API_KEY is required for openai provider")
            _provider = OpenAIEmbeddingProvider(
                api_key=settings.openai_api_key,
                model=settings.embedding_model,
            )
        case "cohere":
            if not settings.cohere_api_key:
                raise ValueError("COHERE_API_KEY is required for cohere provider")
            _provider = CohereEmbeddingProvider(
                api_key=settings.cohere_api_key,
                model=settings.embedding_model,
            )
        case _:
            raise ValueError(
                f"Unknown embedding provider: {settings.embedding_provider}"
            )

    logger.info(
        "embedding_provider_initialised",
        provider=settings.embedding_provider,
        model=settings.embedding_model,
        dimensions=_provider.dimensions,
    )


def get_provider() -> EmbeddingProvider:
    """Return the initialised embedding provider singleton."""
    if _provider is None:
        raise RuntimeError(
            "Embedding provider not initialised — call init_embedding_provider() first"
        )
    return _provider
