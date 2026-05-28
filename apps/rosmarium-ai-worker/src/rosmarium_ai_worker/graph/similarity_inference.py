"""Similarity inference — creates graph edges based on embedding cosine similarity.

Queries the per-content-type embedding table for the source entry's embedding,
then finds the most similar entries (within the same or any content type) using
pgvector's <=> operator and inserts 'relatedTo' edges for results above threshold.
"""

from __future__ import annotations

import uuid

import asyncpg
import structlog

logger = structlog.get_logger(__name__)

EDGE_TYPE = "relatedTo"


async def infer_from_similarity(
    entry_id: str,
    content_type: str,
    threshold: float,
    max_edges: int,
    conn: asyncpg.Connection,
) -> int:
    """Infer similarity edges from embedding cosine distance.

    Uses the per-content-type embeddings table (rosmarium_{content_type}_embeddings)
    to find the closest neighbours and create bidirectional 'relatedTo' edges.

    Args:
        entry_id: The source content entry ID.
        content_type: The content type slug (used to locate the embedding table).
        threshold: Minimum cosine similarity [0, 1] to create an edge.
        max_edges: Maximum number of edges to create.
        conn: An active asyncpg connection.

    Returns:
        Number of new edges created.
    """
    embedding_table = f"rosmarium_{content_type}_embeddings"

    # Fetch the source embedding (best chunk = highest-quality embedding)
    source_row = await conn.fetchrow(
        f"""
        SELECT embedding
        FROM {embedding_table}
        WHERE content_entry_id = $1
        ORDER BY chunk_index
        LIMIT 1
        """,  # noqa: S608
        entry_id,
    )

    if source_row is None:
        logger.info(
            "similarity_inference_no_embedding",
            entry_id=entry_id,
            content_type=content_type,
        )
        return 0

    embedding = source_row["embedding"]
    edges_created = 0

    # Find similar entries using pgvector cosine distance (1 - cosine_similarity)
    similar_rows = await conn.fetch(
        f"""
        SELECT DISTINCT ON (e.content_entry_id) e.content_entry_id,
               ce.content_type_id,
               ct.name AS content_type_name,
               1 - (e.embedding <=> $1::vector) AS similarity
        FROM {embedding_table} e
        JOIN content_entries ce ON ce.id = e.content_entry_id
        JOIN content_types  ct ON ct.id = ce.content_type_id
        WHERE e.content_entry_id <> $2
          AND 1 - (e.embedding <=> $1::vector) >= $3
        ORDER BY e.content_entry_id, (e.embedding <=> $1::vector)
        LIMIT $4
        """,  # noqa: S608
        embedding,
        entry_id,
        threshold,
        max_edges,
    )

    for row in similar_rows:
        other_id: str = row["content_entry_id"]
        other_ct: str = row["content_type_name"]
        similarity: float = float(row["similarity"])
        weight: float = round(similarity, 4)

        try:
            # Forward edge
            await conn.execute(
                """
                INSERT INTO graph_edges (
                    id, from_entry_id, from_content_type,
                    to_entry_id, to_content_type,
                    edge_type, weight, source, is_accepted
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT (from_entry_id, to_entry_id, edge_type) DO NOTHING
                """,
                str(uuid.uuid4()),
                entry_id,
                content_type,
                other_id,
                other_ct,
                EDGE_TYPE,
                weight,
                "auto_similarity",
                "pending",
            )
            # Reverse edge (bidirectional)
            await conn.execute(
                """
                INSERT INTO graph_edges (
                    id, from_entry_id, from_content_type,
                    to_entry_id, to_content_type,
                    edge_type, weight, source, is_accepted
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT (from_entry_id, to_entry_id, edge_type) DO NOTHING
                """,
                str(uuid.uuid4()),
                other_id,
                other_ct,
                entry_id,
                content_type,
                EDGE_TYPE,
                weight,
                "auto_similarity",
                "pending",
            )
            edges_created += 1
        except Exception:
            logger.warning(
                "similarity_edge_insert_failed",
                entry_id=entry_id,
                other_id=other_id,
            )

    logger.info(
        "similarity_inference_complete",
        entry_id=entry_id,
        edges_created=edges_created,
        candidates=len(similar_rows),
    )
    return edges_created
