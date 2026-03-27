"""BullMQ-compatible Redis queue consumer.

Reads jobs from the 'embedding-jobs' queue using BullMQ's Redis key schema:
  bull:{queue}:waiting   → Redis list of job IDs
  bull:{queue}:{id}      → Redis hash with name, data, opts, timestamp
"""

import asyncio
import json
from collections.abc import Callable, Coroutine
from typing import Any

import redis.asyncio as aioredis
import structlog

from ..config import settings

logger = structlog.get_logger(__name__)

# Type alias for job handler functions
JobHandler = Callable[[dict[str, Any]], Coroutine[Any, Any, None]]


class QueueConsumer:
    """BullMQ-compatible async Redis queue consumer."""

    def __init__(self, queue_name: str, concurrency: int) -> None:
        self._queue_name = queue_name
        self._concurrency = concurrency
        self._redis: aioredis.Redis | None = None
        self._running = False
        self._tasks: list[asyncio.Task[None]] = []
        self._handlers: dict[str, JobHandler] = {}

    def register_handler(self, job_name: str, handler: JobHandler) -> None:
        """Register a handler function for a specific job name."""
        self._handlers[job_name] = handler
        logger.info("registered_job_handler", job_name=job_name, queue=self._queue_name)

    async def start(self) -> None:
        """Connect to Redis and start worker loops."""
        self._redis = aioredis.from_url(settings.redis_url)
        self._running = True
        for i in range(self._concurrency):
            task = asyncio.create_task(self._worker_loop(), name=f"worker-{i}")
            self._tasks.append(task)
        logger.info(
            "queue_consumer_started",
            queue=self._queue_name,
            concurrency=self._concurrency,
        )

    async def stop(self) -> None:
        """Stop all worker loops and close Redis connection."""
        self._running = False
        for task in self._tasks:
            task.cancel()
        await asyncio.gather(*self._tasks, return_exceptions=True)
        self._tasks.clear()
        if self._redis:
            await self._redis.aclose()
            self._redis = None
        logger.info("queue_consumer_stopped", queue=self._queue_name)

    async def _worker_loop(self) -> None:
        """Main worker loop — fetch and process jobs until stopped."""
        while self._running:
            try:
                job = await self._fetch_next_job()
                if job:
                    await self._process(job)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("worker_loop_error", error=str(e), queue=self._queue_name)
                await asyncio.sleep(1)

    async def _fetch_next_job(self) -> dict[str, str] | None:
        """Fetch the next job from the waiting list.

        Uses BRPOPLPUSH to atomically move a job ID from waiting to active,
        then fetches the job hash.
        """
        if self._redis is None:
            return None

        waiting_key = f"bull:{self._queue_name}:waiting"
        active_key = f"bull:{self._queue_name}:active"

        # BRPOPLPUSH: blocking pop from waiting, push to active
        result: bytes | None = await self._redis.brpoplpush(  # type: ignore[misc]
            waiting_key, active_key, timeout=5
        )

        if result is None:
            return None

        job_id = result.decode() if isinstance(result, bytes) else str(result)

        # Fetch the job hash
        job_key = f"bull:{self._queue_name}:{job_id}"
        job_data: dict[bytes | str, bytes | str] = await self._redis.hgetall(job_key)  # type: ignore[misc]

        if not job_data:
            logger.warning("job_hash_missing", job_id=job_id, queue=self._queue_name)
            return None

        # Decode bytes to strings
        decoded: dict[str, str] = {
            (k.decode() if isinstance(k, bytes) else str(k)): (
                v.decode() if isinstance(v, bytes) else str(v)
            )
            for k, v in job_data.items()
        }
        decoded["id"] = job_id
        return decoded

    async def _process(self, job: dict[str, str]) -> None:
        """Dispatch a job to its registered handler."""
        job_name = job.get("name", "")
        handler = self._handlers.get(job_name)

        if not handler:
            logger.warning(
                "no_handler_for_job",
                job_name=job_name,
                job_id=job.get("id"),
                queue=self._queue_name,
            )
            return

        job_id = job.get("id", "unknown")
        try:
            data = json.loads(job.get("data", "{}"))
            await handler(data)
            await self._mark_completed(job_id)
            logger.info("job_completed", job_id=job_id, job_name=job_name)
        except Exception as e:
            logger.error(
                "job_failed",
                job_id=job_id,
                job_name=job_name,
                error=str(e),
                queue=self._queue_name,
            )
            await self._mark_failed(job_id, str(e))

    async def _mark_completed(self, job_id: str) -> None:
        """Move job from active to completed."""
        if self._redis is None:
            return
        active_key = f"bull:{self._queue_name}:active"
        completed_key = f"bull:{self._queue_name}:completed"
        await self._redis.lrem(active_key, 1, job_id)  # type: ignore[misc]
        await self._redis.lpush(completed_key, job_id)  # type: ignore[misc]

    async def _mark_failed(self, job_id: str, error: str) -> None:
        """Move job from active to failed and record the error."""
        if self._redis is None:
            return
        active_key = f"bull:{self._queue_name}:active"
        failed_key = f"bull:{self._queue_name}:failed"
        await self._redis.lrem(active_key, 1, job_id)  # type: ignore[misc]
        await self._redis.lpush(failed_key, job_id)  # type: ignore[misc]
        # Store fail reason on the job hash
        job_key = f"bull:{self._queue_name}:{job_id}"
        await self._redis.hset(job_key, "failedReason", error)  # type: ignore[misc]


# Singleton consumer instance
consumer = QueueConsumer(
    queue_name="embedding-jobs",
    concurrency=settings.embedding_queue_concurrency,
)


async def start_consumer() -> None:
    """Initialise and start the queue consumer with registered handlers."""
    from .embedding_worker import process_embedding_job

    consumer.register_handler("embed-content", process_embedding_job)
    await consumer.start()


async def stop_consumer() -> None:
    """Stop the queue consumer gracefully."""
    await consumer.stop()
