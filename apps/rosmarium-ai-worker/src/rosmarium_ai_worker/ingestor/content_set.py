"""Content set lifecycle manager for the Rosmarium ingestor.

A Content Set is a named batch of entries all imported from one crawl job.
It can be reviewed, bulk-published, or rolled back as a unit.
"""

from __future__ import annotations

from typing import Any

import structlog

from ..database import get_pool

logger = structlog.get_logger(__name__)


class ContentSetManager:
    """Manages content set DB records throughout the ingestion lifecycle."""

    async def create(
        self,
        *,
        job_id: str,
        name: str,
        description: str | None,
        source_url: str,
        config: dict[str, Any],
        tenant_id: str | None,
        created_by: str | None,
    ) -> str:
        """Create an initial content set record and return its ID."""
        pool = await get_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO content_sets
                    (id, name, description, source_url, job_id, status,
                     config, stats, tenant_id, created_by, created_at)
                VALUES (
                    gen_random_uuid()::text, $1, $2, $3, $4, 'queued',
                    $5::jsonb, '{}'::jsonb, $6, $7, now()
                )
                RETURNING id
                """,
                name,
                description,
                source_url,
                job_id,
                __import__("json").dumps(config),
                tenant_id,
                created_by,
            )
        if not row:
            raise RuntimeError("Failed to create content set record")
        return str(row["id"])

    async def update_status(
        self,
        job_id: str,
        status: str,
        stats: dict[str, Any],
        completed_at: str | None = None,
    ) -> None:
        """Update the status and stats of a content set."""
        pool = await get_pool()
        async with pool.acquire() as conn:
            if completed_at:
                await conn.execute(
                    """
                    UPDATE content_sets
                    SET status = $1, stats = $2::jsonb, completed_at = $3::timestamptz
                    WHERE job_id = $4
                    """,
                    status,
                    __import__("json").dumps(stats),
                    completed_at,
                    job_id,
                )
            else:
                await conn.execute(
                    """
                    UPDATE content_sets
                    SET status = $1, stats = $2::jsonb
                    WHERE job_id = $3
                    """,
                    status,
                    __import__("json").dumps(stats),
                    job_id,
                )

    async def add_item(
        self,
        *,
        content_set_id: str,
        entry_id: str,
        source_url: str,
        content_type: str,
        classification_confidence: float,
        item_status: str = "imported",
    ) -> None:
        """Record a single imported item in the content set."""
        pool = await get_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO content_set_items
                    (id, content_set_id, entry_id, source_url, content_type,
                     classification_confidence, status, created_at)
                VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, now())
                """,
                content_set_id,
                entry_id,
                source_url,
                content_type,
                classification_confidence,
                item_status,
            )


content_set_manager = ContentSetManager()
