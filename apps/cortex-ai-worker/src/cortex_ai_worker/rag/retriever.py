"""LlamaIndex retriever setup for a single content type.

Wraps PGVectorStore + VectorStoreIndex so that the RAGPipeline can call
``index_manager.search()`` directly (more reliable against our custom schema)
while still benefiting from LlamaIndex's index management utilities when needed.
"""

from __future__ import annotations

import structlog
from llama_index.core import VectorStoreIndex
from llama_index.vector_stores.postgres import PGVectorStore  # noqa: PLC0415

from ..config import settings
from ..embedding.registry import get_provider

logger = structlog.get_logger(__name__)


class RosmariumRetriever:
    """Builds and exposes a LlamaIndex retriever for a single content type.

    Args:
        content_type: The content type name (used for table name derivation).
        top_k:        Number of results to retrieve (default 10).
    """

    def __init__(self, content_type: str, top_k: int = 10) -> None:
        self._content_type = content_type
        self._top_k = top_k
        self._index: VectorStoreIndex | None = None

    async def build(self) -> None:
        """Construct the VectorStoreIndex backed by our PGVector table."""
        provider = get_provider()
        vector_store = PGVectorStore.from_params(
            database=settings.db_name if hasattr(settings, "db_name") else _parse_db_name(settings.database_url),
            host=settings.db_host if hasattr(settings, "db_host") else _parse_db_host(settings.database_url),
            port=int(settings.db_port if hasattr(settings, "db_port") else _parse_db_port(settings.database_url)),
            user=settings.db_user if hasattr(settings, "db_user") else _parse_db_user(settings.database_url),
            password=settings.db_password if hasattr(settings, "db_password") else _parse_db_password(settings.database_url),
            table_name=f"rosmarium_{self._content_type}_embeddings",
            embed_dim=provider.dimensions,
            hnsw_kwargs={
                "hnsw_m": 16,
                "hnsw_ef_construction": 64,
                "hnsw_ef_search": 40,
            },
        )
        self._index = VectorStoreIndex.from_vector_store(vector_store)
        logger.debug(
            "rosmarium_retriever_built",
            content_type=self._content_type,
            dimensions=provider.dimensions,
        )

    def as_retriever(self) -> object:
        """Return the LlamaIndex retriever (similarity_top_k=self._top_k)."""
        if self._index is None:
            raise RuntimeError("RosmariumRetriever.build() must be called before as_retriever()")
        return self._index.as_retriever(similarity_top_k=self._top_k)


# ─── URL parsers (fallback when individual db_* fields are not on Settings) ───

def _parse_db_name(url: str) -> str:
    """Extract database name from a postgres://user:pass@host:port/db URL."""
    return url.rstrip("/").rsplit("/", 1)[-1].split("?")[0]


def _parse_db_host(url: str) -> str:
    """Extract host from postgres URL."""
    # postgres://user:pass@host:port/db
    at_part = url.split("@", 1)[-1]
    host_port = at_part.split("/")[0]
    return host_port.split(":")[0]


def _parse_db_port(url: str) -> str:
    """Extract port from postgres URL (default 5432)."""
    at_part = url.split("@", 1)[-1]
    host_port = at_part.split("/")[0]
    parts = host_port.split(":")
    return parts[1] if len(parts) > 1 else "5432"


def _parse_db_user(url: str) -> str:
    """Extract user from postgres URL."""
    # postgres://user:pass@...
    credentials = url.split("://", 1)[-1].split("@")[0]
    return credentials.split(":")[0]


def _parse_db_password(url: str) -> str:
    """Extract password from postgres URL."""
    credentials = url.split("://", 1)[-1].split("@")[0]
    parts = credentials.split(":", 1)
    return parts[1] if len(parts) > 1 else ""
