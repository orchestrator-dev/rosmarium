"""Semantic duplicate detection using pgvector cosine similarity.

Compares a content entry's embedding against other entries of the same type
to find near-duplicates above a configurable similarity threshold.
"""

from __future__ import annotations

import asyncio
from typing import Any

import asyncpg
import structlog
from pydantic import BaseModel

from ..config import settings

logger = structlog.get_logger(__name__)


class DuplicateCandidate(BaseModel):
    """A potential duplicate content entry."""

    entry_id: str
    content_type: str
    similarity_score: float  # 0.0-1.0 cosine similarity
    is_duplicate: bool  # score >= threshold


class DuplicateDetector:
    """Detects semantic duplicates via pgvector cosine similarity."""

    def __init__(self) -> None:
        self._threshold: float = settings.duplicate_threshold

    async def find_duplicates(
        self,
        entry_id: str,
        content_type: str,
        embedding: list[float],
        conn: Any,
        limit: int = 5,
    ) -> list[DuplicateCandidate]:
        """Find entries similar to the given embedding.

        Uses pgvector cosine distance (<=>) to rank results.
        Returns near-misses (threshold - 0.05) so callers can see related content.

        Args:
            entry_id: The entry whose embedding we're comparing against.
            content_type: Content type name (used to derive table name).
            embedding: Vector to search with.
            conn: Active asyncpg connection.
            limit: Maximum number of candidates to return.

        Returns:
            List of DuplicateCandidate sorted by similarity descending.
        """
        table = f"rosmarium_{content_type}_embeddings"
        near_miss_threshold = max(0.0, self._threshold - 0.05)

        # Format embedding vector for pgvector
        vec_str = "[" + ",".join(str(v) for v in embedding) + "]"

        try:
            rows = await conn.fetch(
                f"""
                SELECT DISTINCT content_entry_id,
                       1 - (embedding <=> $1::vector) AS score
                FROM {table}
                WHERE content_entry_id != $2
                ORDER BY embedding <=> $1::vector
                LIMIT $3
                """,
                vec_str,
                entry_id,
                limit,
            )
        except asyncpg.exceptions.UndefinedTableError:
            logger.debug("duplicate_detector_table_missing", table=table)
            return []
        except Exception as e:
            logger.warning("duplicate_detector_query_failed", table=table, error=str(e))
            return []

        candidates = []
        for row in rows:
            score = float(row["score"])
            if score < near_miss_threshold:
                continue
            candidates.append(
                DuplicateCandidate(
                    entry_id=str(row["content_entry_id"]),
                    content_type=content_type,
                    similarity_score=round(score, 4),
                    is_duplicate=score >= self._threshold,
                )
            )

        return sorted(candidates, key=lambda c: c.similarity_score, reverse=True)

    async def scan_collection(
        self,
        content_type: str,
        conn: Any,
        batch_size: int = 100,
    ) -> list[tuple[str, str, float]]:
        """Scan all entries in a collection for duplicate pairs.

        Processes in batches to avoid loading all embeddings into memory.

        Returns:
            List of (entry_id_a, entry_id_b, similarity_score) tuples above threshold.
        """
        table = f"rosmarium_{content_type}_embeddings"

        try:
            # Get distinct entry IDs
            id_rows = await conn.fetch(
                f"SELECT DISTINCT content_entry_id FROM {table}"
            )
        except asyncpg.exceptions.UndefinedTableError:
            return []
        except Exception as e:
            logger.warning("scan_collection_failed", table=table, error=str(e))
            return []

        entry_ids = [str(r["content_entry_id"]) for r in id_rows]
        pairs: list[tuple[str, str, float]] = []
        seen: set[tuple[str, str]] = set()

        for i in range(0, len(entry_ids), batch_size):
            batch = entry_ids[i : i + batch_size]
            for entry_id in batch:
                try:
                    # Get this entry's embedding
                    row = await conn.fetchrow(
                        f"SELECT embedding FROM {table} WHERE content_entry_id = $1 LIMIT 1",
                        entry_id,
                    )
                    if not row:
                        continue

                    embedding = list(row["embedding"])
                    candidates = await self.find_duplicates(
                        entry_id, content_type, embedding, conn, limit=10
                    )

                    for c in candidates:
                        if not c.is_duplicate:
                            continue
                        pair = tuple(sorted([entry_id, c.entry_id]))
                        key = (pair[0], pair[1])
                        if key not in seen:
                            seen.add(key)
                            pairs.append((pair[0], pair[1], c.similarity_score))

                except Exception as e:
                    logger.warning(
                        "scan_entry_failed", entry_id=entry_id, error=str(e)
                    )
                    continue

                # Yield control periodically
                await asyncio.sleep(0)

        return sorted(pairs, key=lambda p: p[2], reverse=True)


# Singleton
duplicate_detector = DuplicateDetector()
