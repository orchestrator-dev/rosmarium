"""BullMQ handler for 'ingest-website' jobs in the 'ingestion-jobs' queue.

Validates the job payload, runs the IngestionPipeline, and writes live
progress updates to Redis (for SSE streaming from rosmarium-server).
"""

from __future__ import annotations

from typing import Any

import redis.asyncio as aioredis
import structlog
from pydantic import BaseModel

from ..config import settings
from ..ingestor.content_set import content_set_manager
from ..ingestor.models import ContentSetStatus, IngestorConfig
from ..ingestor.pipeline import IngestionPipeline

logger = structlog.get_logger(__name__)

_STATUS_KEY_PREFIX = "ingestor:status:"
_PROGRESS_CHANNEL_PREFIX = "ingestor:progress:"


class IngestionJobPayload(BaseModel):
    """Validated payload for an ingest-website BullMQ job."""

    jobId: str
    contentSetId: str
    config: IngestorConfig


async def process_ingestion_job(raw_payload: dict[str, Any]) -> None:
    """Entry point for the 'ingest-website' BullMQ job.

    Called by the QueueConsumer when a job is dequeued from 'ingestion-jobs'.
    Runs the IngestionPipeline and streams status updates to Redis pub/sub.
    """
    payload = IngestionJobPayload.model_validate(raw_payload)

    redis_client = aioredis.from_url(settings.redis_url)

    async def on_status_update(status: ContentSetStatus) -> None:
        """Write status to Redis KV and publish to pub/sub channel for SSE."""
        status_json = status.model_dump_json()
        try:
            await redis_client.set(  # type: ignore[misc]
                f"{_STATUS_KEY_PREFIX}{payload.jobId}",
                status_json,
                ex=86400,  # 24h TTL
            )
            await redis_client.publish(  # type: ignore[misc]
                f"{_PROGRESS_CHANNEL_PREFIX}{payload.jobId}",
                status_json,
            )
        except Exception as e:
            logger.warning("status_publish_failed", error=str(e))

    try:
        # Mark queued → running in DB
        await content_set_manager.update_status(
            payload.jobId,
            "crawling",
            {
                "totalPages": 0,
                "crawledPages": 0,
                "importedEntries": 0,
                "skippedDuplicates": 0,
                "failedPages": 0,
            },
        )

        pipeline = IngestionPipeline()
        final_status = await pipeline.run(
            config=payload.config,
            job_id=payload.jobId,
            content_set_id=payload.contentSetId,
            status_callback=on_status_update,
        )

        started_at = final_status.startedAt
        completed_at = final_status.completedAt
        duration_s = (
            int((completed_at - started_at).total_seconds())
            if started_at and completed_at
            else 0
        )

        logger.info(
            "ingestion_complete",
            job_id=payload.jobId,
            status=final_status.status,
            pages_crawled=final_status.crawledPages,
            entries_imported=final_status.importedEntries,
            skipped=final_status.skippedDuplicates,
            failed=final_status.failedPages,
            duration_s=duration_s,
        )
    finally:
        await redis_client.aclose()
