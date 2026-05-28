"""Reference inference — detects explicit slug/ID references in text content.

Scans text for patterns that resemble content entry references:
  - [[entry-slug]] wiki-style references
  - /content/{slug} URL path patterns
  - Matches against known content entry slugs in the DB

Creates 'references' edges from the source entry to referenced entries.
"""

from __future__ import annotations

import re
import uuid

import asyncpg
import structlog

logger = structlog.get_logger(__name__)

EDGE_TYPE = "references"

# Patterns that indicate an explicit reference to another entry
_WIKI_LINK_RE = re.compile(r"\[\[([^\[\]]+)\]\]")
_URL_PATH_RE = re.compile(r"/content/([a-z0-9-]+)", re.IGNORECASE)


def _extract_slugs(text: str) -> list[str]:
    """Extract candidate slugs from text using reference patterns."""
    candidates: list[str] = []
    candidates.extend(m.group(1).strip() for m in _WIKI_LINK_RE.finditer(text))
    candidates.extend(m.group(1).strip() for m in _URL_PATH_RE.finditer(text))
    # Deduplicate while preserving order
    seen: set[str] = set()
    unique: list[str] = []
    for slug in candidates:
        if slug and slug not in seen:
            seen.add(slug)
            unique.append(slug)
    return unique


async def infer_from_references(
    entry_id: str,
    content_type: str,
    text_content: str,
    conn: asyncpg.Connection,
) -> int:
    """Infer explicit reference edges from text content.

    Args:
        entry_id: The source content entry ID.
        content_type: The content type slug of the source entry.
        text_content: Concatenated text content of all fields.
        conn: An active asyncpg connection.

    Returns:
        Number of new edges created.
    """
    slugs = _extract_slugs(text_content)
    if not slugs:
        return 0

    edges_created = 0

    # Look up each candidate slug in content_entries JSONB data
    for slug in slugs:
        rows = await conn.fetch(
            """
            SELECT ce.id, ct.name AS content_type_name
            FROM content_entries ce
            JOIN content_types ct ON ct.id = ce.content_type_id
            WHERE ce.id   <> $1
              AND (
                  ce.data->>'slug'  = $2
               OR ce.data->>'title' ILIKE $3
              )
            LIMIT 5
            """,
            entry_id,
            slug,
            slug,
        )

        for row in rows:
            other_id: str = row["id"]
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
                    other_id,
                    other_ct,
                    EDGE_TYPE,
                    1.0,
                    "auto_reference",
                    "pending",
                )
                edges_created += 1
            except Exception:
                logger.warning(
                    "reference_edge_insert_failed",
                    entry_id=entry_id,
                    other_id=other_id,
                    slug=slug,
                )

    logger.info(
        "reference_inference_complete",
        entry_id=entry_id,
        edges_created=edges_created,
        slugs_found=len(slugs),
    )
    return edges_created
