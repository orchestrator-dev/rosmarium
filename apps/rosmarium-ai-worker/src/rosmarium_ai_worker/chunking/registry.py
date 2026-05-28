"""Chunking strategy factory — maps strategy name to ChunkingStrategy instance."""

from __future__ import annotations

from ..config import settings
from .base import ChunkingStrategy


def get_chunker(
    strategy: str | None = None,
    chunk_size: int | None = None,
    overlap: int | None = None,
) -> ChunkingStrategy:
    """Return a ChunkingStrategy for *strategy* (defaults to settings).

    Args:
        strategy:   One of "fixed", "sentence", "section".  Defaults to
                    ``settings.chunking_default_strategy``.
        chunk_size: Override the default chunk size from settings.
        overlap:    Override the default overlap from settings.

    Returns:
        A ready-to-use ChunkingStrategy instance.

    Raises:
        ValueError: If *strategy* is not a recognised name.
    """
    resolved_strategy = strategy or settings.chunking_default_strategy
    size = chunk_size or settings.chunking_chunk_size
    ovlp = overlap if overlap is not None else settings.chunking_chunk_overlap

    match resolved_strategy:
        case "fixed":
            from .fixed import FixedSizeChunker
            return FixedSizeChunker(chunk_size=size, overlap=ovlp)

        case "sentence":
            from .sentence import SentenceChunker
            return SentenceChunker(chunk_size=size, overlap=ovlp)

        case "section":
            from .section import SectionChunker
            return SectionChunker(chunk_size=size, overlap=ovlp)

        case _:
            raise ValueError(
                f"Unknown chunking strategy '{resolved_strategy}'. "
                "Valid values: fixed, sentence, section."
            )
