"""pgvector index manager — table creation, upsert, delete, and search.

HNSW params follow .agent/skills/pgvector-ops: m=16, ef_construction=64.
"""

import json

import asyncpg
import structlog

logger = structlog.get_logger(__name__)


class VectorIndexManager:
    """Manages pgvector embedding tables and operations."""

    async def ensure_table(
        self,
        content_type: str,
        dimensions: int,
        conn: asyncpg.Connection,
    ) -> None:
        """Create the embedding table and HNSW index if they don't exist."""
        table = f"cortex_{content_type}_embeddings"

        await conn.execute(f"""
            CREATE TABLE IF NOT EXISTS {table} (
                id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
                content_entry_id TEXT NOT NULL,
                chunk_index INTEGER NOT NULL,
                chunk_text TEXT NOT NULL,
                embedding vector({dimensions}),
                metadata JSONB NOT NULL DEFAULT '{{}}'::jsonb,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                UNIQUE(content_entry_id, chunk_index)
            )
        """)

        await conn.execute(f"""
            CREATE INDEX IF NOT EXISTS {table}_embedding_hnsw_idx
            ON {table} USING hnsw (embedding vector_cosine_ops)
            WITH (m = 16, ef_construction = 64)
        """)

        await conn.execute(f"""
            CREATE INDEX IF NOT EXISTS {table}_entry_idx
            ON {table} (content_entry_id)
        """)

        logger.debug("ensured_vector_table", table=table, dimensions=dimensions)

    async def upsert_embeddings(
        self,
        content_type: str,
        content_entry_id: str,
        chunks: list[dict[str, object]],
        conn: asyncpg.Connection,
    ) -> None:
        """Upsert embeddings for a content entry — deletes existing then inserts new.

        Args:
            content_type: The content type (used for table name).
            content_entry_id: The content entry ID.
            chunks: List of dicts with keys: chunk_index, chunk_text, embedding, metadata.
            conn: asyncpg connection.
        """
        table = f"cortex_{content_type}_embeddings"

        async with conn.transaction():
            # Delete existing embeddings for this entry
            await conn.execute(
                f"DELETE FROM {table} WHERE content_entry_id = $1",
                content_entry_id,
            )

            # Batch insert new embeddings
            if chunks:
                await conn.executemany(
                    f"""
                    INSERT INTO {table}
                        (content_entry_id, chunk_index, chunk_text, embedding, metadata)
                    VALUES ($1, $2, $3, $4::vector, $5::jsonb)
                    """,
                    [
                        (
                            content_entry_id,
                            chunk["chunk_index"],
                            chunk["chunk_text"],
                            json.dumps(chunk["embedding"]),
                            json.dumps(chunk["metadata"]),
                        )
                        for chunk in chunks
                    ],
                )

        logger.info(
            "upserted_embeddings",
            table=table,
            content_entry_id=content_entry_id,
            chunk_count=len(chunks),
        )

    async def delete_embeddings(
        self,
        content_type: str,
        content_entry_id: str,
        conn: asyncpg.Connection,
    ) -> None:
        """Delete all embeddings for a content entry."""
        table = f"cortex_{content_type}_embeddings"
        await conn.execute(
            f"DELETE FROM {table} WHERE content_entry_id = $1",
            content_entry_id,
        )
        logger.info(
            "deleted_embeddings",
            table=table,
            content_entry_id=content_entry_id,
        )

    async def search(
        self,
        content_type: str,
        query_embedding: list[float],
        limit: int = 10,
        allowed_entry_ids: list[str] | None = None,
        conn: asyncpg.Connection | None = None,
    ) -> list[dict[str, object]]:
        """Search for nearest embedding vectors with optional ACL filtering.

        Args:
            content_type: The content type (used for table name).
            query_embedding: The query vector.
            limit: Max results to return.
            allowed_entry_ids: If provided, restrict results to these content entry IDs.
            conn: asyncpg connection.

        Returns:
            List of result dicts with keys:
            content_entry_id, chunk_index, chunk_text, score, metadata.
        """
        if conn is None:
            raise RuntimeError("Database connection is required for search")

        table = f"cortex_{content_type}_embeddings"
        embedding_str = json.dumps(query_embedding)

        try:
            if allowed_entry_ids is not None:
                rows = await conn.fetch(
                    f"""
                    SELECT content_entry_id, chunk_index, chunk_text,
                           1 - (embedding <=> $1::vector) AS score,
                           metadata
                    FROM {table}
                    WHERE content_entry_id = ANY($2)
                      AND embedding IS NOT NULL
                    ORDER BY embedding <=> $1::vector
                    LIMIT $3
                    """,
                    embedding_str,
                    allowed_entry_ids,
                    limit,
                )
            else:
                rows = await conn.fetch(
                    f"""
                    SELECT content_entry_id, chunk_index, chunk_text,
                           1 - (embedding <=> $1::vector) AS score,
                           metadata
                    FROM {table}
                    WHERE embedding IS NOT NULL
                    ORDER BY embedding <=> $1::vector
                    LIMIT $2
                    """,
                    embedding_str,
                    limit,
                )
        except Exception as exc:
            # Table may not exist yet if this content type has never been embedded
            err_str = str(exc)
            if "UndefinedTable" in type(exc).__name__ or "does not exist" in err_str:
                logger.info("search_table_not_found", table=table)
                return []
            raise

        return [
            {
                "content_entry_id": str(row["content_entry_id"]),
                "chunk_index": int(row["chunk_index"]),
                "chunk_text": str(row["chunk_text"]),
                "score": float(row["score"]),
                "metadata": json.loads(row["metadata"])
                if isinstance(row["metadata"], str)
                else dict(row["metadata"]),
            }
            for row in rows
        ]
