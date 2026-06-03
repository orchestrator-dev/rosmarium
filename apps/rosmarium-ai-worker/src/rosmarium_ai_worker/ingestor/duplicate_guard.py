"""Duplicate detection guard for the Rosmarium ingestor.

Prevents re-importing content that already exists in Rosmarium.
Uses URL matching first (fast), then embedding cosine similarity as fallback.
"""

from __future__ import annotations

import structlog

from ..embedding.registry import get_provider

logger = structlog.get_logger(__name__)


class DuplicateGuard:
    """Prevents re-importing content already present in Rosmarium.

    Strategy 1 (fast): Check if data->>'_sourceUrl' matches any existing entry
                        for this content type.
    Strategy 2 (semantic): Embed page text, compare against existing embeddings
                            via cosine similarity.
    """

    def __init__(self, similarity_threshold: float = 0.92) -> None:
        self._threshold = similarity_threshold

    async def check(
        self,
        source_url: str,
        title: str | None,
        markdown: str,
        content_type_name: str,
        conn: object,  # asyncpg.Connection — typed loosely to avoid hard dep
    ) -> tuple[bool, str | None, float | None]:
        """Check if content already exists in Rosmarium.

        Returns:
            (is_duplicate, existing_entry_id, similarity_score)
        """
        # Strategy 1: URL match
        try:
            row = await conn.fetchrow(  # type: ignore[attr-defined]
                """
                SELECT ce.id
                FROM content_entries ce
                JOIN content_types ct ON ce.content_type_id = ct.id
                WHERE ct.name = $1
                  AND ce.data->>'_sourceUrl' = $2
                LIMIT 1
                """,
                content_type_name,
                source_url,
            )
            if row:
                return True, str(row["id"]), 1.0
        except Exception as e:
            logger.warning("url_duplicate_check_error", error=str(e))

        # Strategy 2: Embedding similarity
        try:
            provider = get_provider()
            page_text = f"{title or ''} {markdown[:200]}"
            query_vec = await provider.embed_one(page_text)

            # Look for existing embeddings for this content type
            # The embedding table is named rosmarium_{contentType}_embeddings
            safe_ct = content_type_name.replace("-", "_").replace(" ", "_")
            table = f"rosmarium_{safe_ct}_embeddings"

            rows = await conn.fetch(  # type: ignore[attr-defined]
                f"""
                SELECT content_entry_id,
                       1 - (embedding <=> $1::vector) AS similarity
                FROM {table}
                ORDER BY embedding <=> $1::vector
                LIMIT 5
                """,
                query_vec,
            )

            for row in rows:
                similarity = float(row["similarity"])
                if similarity > self._threshold:
                    return True, str(row["content_entry_id"]), similarity

        except Exception as e:
            # Embedding table may not exist for this content type — that's OK
            logger.debug("embedding_duplicate_check_skipped", error=str(e))

        return False, None, None
