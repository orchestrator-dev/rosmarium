"""NER inference — creates entity nodes and co-mention graph edges from NER results.

For each named entity in ner_results:
1. Upsert a graph_entity_nodes row (canonical_text, entity_type).
2. Upsert an entry_entity_mentions row linking the source entry to the entity.
3. Find other entries that mention the same entity.
4. Create pending 'mentions' edges between those entries and the source entry.
"""

from __future__ import annotations

import uuid

import asyncpg
import structlog

logger = structlog.get_logger(__name__)

# Edge type produced by this strategy
EDGE_TYPE = "mentions"


async def infer_from_ner(
    entry_id: str,
    content_type: str,
    ner_results: dict[str, list[str]],
    conn: asyncpg.Connection,
) -> int:
    """Infer entity co-mention edges from NER results.

    Args:
        entry_id: The source content entry ID.
        content_type: The content type slug of the source entry.
        ner_results: Dict mapping entity type → list of entity texts.
                     e.g. {"PERSON": ["Alice Johnson"], "ORG": ["ACME"]}
        conn: An active asyncpg connection.

    Returns:
        Number of new edges created.
    """
    edges_created = 0

    for entity_type, entity_texts in ner_results.items():
        for entity_text in entity_texts:
            if not entity_text or not entity_text.strip():
                continue

            canonical = entity_text.lower().strip()

            # 1. Upsert entity node
            entity_row = await conn.fetchrow(
                """
                INSERT INTO graph_entity_nodes (id, entity_text, canonical_text, entity_type, mention_count)
                VALUES ($1, $2, $3, $4, 1)
                ON CONFLICT (canonical_text, entity_type)
                    DO UPDATE SET mention_count = graph_entity_nodes.mention_count + 1,
                                  updated_at   = now()
                RETURNING id
                """,
                str(uuid.uuid4()),
                entity_text.strip(),
                canonical,
                entity_type,
            )
            entity_id: str = entity_row["id"]

            # 2. Upsert mention link for the source entry
            await conn.execute(
                """
                INSERT INTO entry_entity_mentions (id, entry_id, entity_id, confidence)
                VALUES ($1, $2, $3, 1.0)
                ON CONFLICT (entry_id, entity_id) DO NOTHING
                """,
                str(uuid.uuid4()),
                entry_id,
                entity_id,
            )

            # 3. Find other entries that mention the same entity (excluding this one)
            co_mentioners = await conn.fetch(
                """
                SELECT eem.entry_id, ce.content_type_id, ct.name AS content_type_name
                FROM entry_entity_mentions eem
                JOIN content_entries ce ON ce.id = eem.entry_id
                JOIN content_types ct   ON ct.id = ce.content_type_id
                WHERE eem.entity_id = $1
                  AND eem.entry_id  <> $2
                LIMIT 20
                """,
                entity_id,
                entry_id,
            )

            # 4. Create pending 'mentions' edges for each co-mentioner
            for row in co_mentioners:
                other_entry_id: str = row["entry_id"]
                other_ct: str = row["content_type_name"]

                try:
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
                        other_entry_id,
                        other_ct,
                        EDGE_TYPE,
                        0.8,
                        "auto_ner",
                        "pending",
                    )
                    edges_created += 1
                except Exception:
                    logger.warning(
                        "ner_edge_insert_failed",
                        entry_id=entry_id,
                        other_entry_id=other_entry_id,
                    )

    logger.info(
        "ner_inference_complete",
        entry_id=entry_id,
        edges_created=edges_created,
        entity_count=sum(len(v) for v in ner_results.values()),
    )
    return edges_created
