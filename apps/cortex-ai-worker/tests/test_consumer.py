"""Tests for the BullMQ queue consumer."""

import json
from unittest.mock import AsyncMock

from rosmarium_ai_worker.workers.consumer import QueueConsumer


class TestQueueConsumer:
    """Tests for the QueueConsumer class."""

    def test_register_handler(self) -> None:
        consumer = QueueConsumer(queue_name="test-queue", concurrency=1)
        handler = AsyncMock()
        consumer.register_handler("test-job", handler)
        assert "test-job" in consumer._handlers

    def test_multiple_handlers(self) -> None:
        consumer = QueueConsumer(queue_name="test-queue", concurrency=2)
        handler_a = AsyncMock()
        handler_b = AsyncMock()
        consumer.register_handler("job-a", handler_a)
        consumer.register_handler("job-b", handler_b)
        assert len(consumer._handlers) == 2

    async def test_process_calls_handler(self) -> None:
        consumer = QueueConsumer(queue_name="test-queue", concurrency=1)
        handler = AsyncMock()
        consumer.register_handler("embed-content", handler)

        # Mock Redis for _mark_completed
        consumer._redis = AsyncMock()

        job = {
            "id": "job-1",
            "name": "embed-content",
            "data": json.dumps({"key": "value"}),
        }
        await consumer._process(job)

        handler.assert_called_once_with({"key": "value"})

    async def test_process_unknown_job_name(self) -> None:
        consumer = QueueConsumer(queue_name="test-queue", concurrency=1)
        consumer._redis = AsyncMock()

        job = {
            "id": "job-2",
            "name": "unknown-job",
            "data": "{}",
        }
        # Should not raise — just logs warning
        await consumer._process(job)

    async def test_process_handler_failure_marks_failed(self) -> None:
        consumer = QueueConsumer(queue_name="test-queue", concurrency=1)
        handler = AsyncMock(side_effect=ValueError("test error"))
        consumer.register_handler("embed-content", handler)
        consumer._redis = AsyncMock()

        job = {
            "id": "job-3",
            "name": "embed-content",
            "data": "{}",
        }
        await consumer._process(job)

        # Should have called _mark_failed (via redis hset)
        consumer._redis.hset.assert_called()
