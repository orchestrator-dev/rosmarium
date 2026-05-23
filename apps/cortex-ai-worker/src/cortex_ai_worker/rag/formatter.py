"""LLM context formatter for RAG retrieved chunks.

Provides two output formats:
  - ``format_for_llm()``  → numbered, source-attributed plain-text context block
  - ``format_as_json()``  → structured list of dicts for client-side assembly
"""

from __future__ import annotations

from .pipeline import RetrievedChunk

_CHARS_PER_TOKEN = 4  # rough approximation


class ContextFormatter:
    """Formats a list of RetrievedChunks for LLM consumption."""

    def format_for_llm(
        self,
        chunks: list[RetrievedChunk],
        query: str,
        max_tokens: int = 4000,
    ) -> str:
        """Build a numbered, source-attributed context block suitable for a system prompt.

        The output is truncated to stay within *max_tokens* (estimated at
        1 token ≈ 4 characters).

        Format example::

            RETRIEVED CONTEXT
            Query: What is the refund policy?

            [1] Source: article/entry-abc
                Score: 0.9231
                ---
                Refunds are processed within 5–7 business days …

            [2] Source: product/entry-xyz
                …

            Use this context to answer the query accurately.
            If the context does not contain enough information, say so.
        """
        budget = max_tokens * _CHARS_PER_TOKEN

        header = f"RETRIEVED CONTEXT\nQuery: {query}\n\n"
        footer = (
            "\nUse this context to answer the query accurately.\n"
            "If the context does not contain enough information, say so."
        )

        used = len(header) + len(footer)
        sections: list[str] = []

        for i, chunk in enumerate(chunks, start=1):
            section = (
                f"[{i}] Source: {chunk.content_type}/{chunk.content_entry_id}\n"
                f"    Score: {chunk.freshness_score:.4f}\n"
                f"    ---\n"
                f"    {chunk.chunk_text}\n\n"
            )
            if used + len(section) > budget:
                # Truncate the chunk text to fit remaining budget
                remaining = budget - used - (len(section) - len(chunk.chunk_text))
                if remaining > 40:  # only add if at least a few tokens fit
                    truncated_text = chunk.chunk_text[:remaining] + "…"
                    section = (
                        f"[{i}] Source: {chunk.content_type}/{chunk.content_entry_id}\n"
                        f"    Score: {chunk.freshness_score:.4f}\n"
                        f"    ---\n"
                        f"    {truncated_text}\n\n"
                    )
                    sections.append(section)
                break
            sections.append(section)
            used += len(section)

        return header + "".join(sections) + footer

    def format_as_json(self, chunks: list[RetrievedChunk]) -> list[dict]:  # type: ignore[type-arg]
        """Return a structured list of chunk dicts for client-side context assembly."""
        return [
            {
                "index": i + 1,
                "source": f"{chunk.content_type}/{chunk.content_entry_id}",
                "content_entry_id": chunk.content_entry_id,
                "content_type": chunk.content_type,
                "chunk_index": chunk.chunk_index,
                "chunk_text": chunk.chunk_text,
                "score": chunk.score,
                "freshness_score": chunk.freshness_score,
                "published_at": chunk.published_at,
                "metadata": chunk.metadata,
            }
            for i, chunk in enumerate(chunks)
        ]

    def estimate_tokens(self, chunks: list[RetrievedChunk]) -> int:
        """Rough token count estimate for a list of chunks (1 token ≈ 4 chars)."""
        return sum(len(c.chunk_text) for c in chunks) // _CHARS_PER_TOKEN


context_formatter = ContextFormatter()
