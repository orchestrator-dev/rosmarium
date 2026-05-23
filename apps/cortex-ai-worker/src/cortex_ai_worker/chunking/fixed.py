"""Fixed-size chunker — adapts the original _simple_chunk logic to ChunkingStrategy."""

from __future__ import annotations

import re
from typing import Any

from .base import Chunk, ChunkingStrategy

_SENTENCE_BOUNDARY = re.compile(r"(?<=[.!?])\s+")


class FixedSizeChunker(ChunkingStrategy):
    """Regex sentence-split chunker (deterministic, no model loading).

    This is a thin adapter around the original ``_simple_chunk`` implementation
    for backwards compatibility and environments without spaCy.

    Args:
        chunk_size: Max characters per chunk (default 512).
        overlap:    Characters from end of previous chunk to prepend (default 50).
    """

    def __init__(self, chunk_size: int = 512, overlap: int = 50) -> None:
        self._chunk_size = chunk_size
        self._overlap = overlap

    def chunk(self, text: str, metadata: dict[str, Any] | None = None) -> list[Chunk]:
        if not text or not text.strip():
            return []

        base_meta: dict[str, Any] = metadata or {}
        sentences = _SENTENCE_BOUNDARY.split(text)
        raw_chunks: list[dict[str, str | int]] = []

        current_text = ""
        current_start = 0
        char_pos = 0

        for sentence in sentences:
            sentence_with_space = sentence if not current_text else " " + sentence

            if len(current_text) + len(sentence_with_space) > self._chunk_size and current_text:
                raw_chunks.append(
                    {"text": current_text.strip(), "char_start": current_start, "char_end": char_pos}
                )
                if self._overlap > 0 and len(current_text) > self._overlap:
                    overlap_text = current_text[-self._overlap:]
                    current_text = overlap_text + " " + sentence
                    current_start = char_pos - self._overlap
                else:
                    current_text = sentence
                    current_start = char_pos
            else:
                current_text += sentence_with_space

            char_pos += len(sentence_with_space)

        if current_text.strip():
            raw_chunks.append(
                {"text": current_text.strip(), "char_start": current_start, "char_end": char_pos}
            )

        if not raw_chunks:
            raw_chunks = [{"text": text.strip(), "char_start": 0, "char_end": len(text)}]

        return [
            Chunk(
                text=str(c["text"]),
                chunk_index=i,
                char_start=int(c["char_start"]),
                char_end=int(c["char_end"]),
                metadata=dict(base_meta),
            )
            for i, c in enumerate(raw_chunks)
        ]
