from unittest.mock import AsyncMock, patch

import pytest

from rosmarium_ai_worker.workers.consumer import QueueConsumer, start_consumer, stop_consumer


@pytest.fixture
def mock_redis():
    mock = AsyncMock()
    mock.brpoplpush = AsyncMock()
    mock.hgetall = AsyncMock()
    mock.lrem = AsyncMock()
    mock.zadd = AsyncMock()
    mock.hset = AsyncMock()
    mock.aclose = AsyncMock()
    return mock

@pytest.mark.asyncio
async def test_queue_consumer_start_stop(mock_redis):
    with patch("rosmarium_ai_worker.workers.consumer.aioredis.from_url", return_value=mock_redis):
        consumer = QueueConsumer("test-queue", concurrency=1)
        await consumer.start()
        
        assert consumer._running is True
        assert len(consumer._tasks) == 1
        
        await consumer.stop()
        
        assert consumer._running is False
        assert len(consumer._tasks) == 0
        mock_redis.aclose.assert_called_once()

@pytest.mark.asyncio
async def test_fetch_next_job(mock_redis):
    consumer = QueueConsumer("test-queue", concurrency=1)
    consumer._redis = mock_redis
    
    mock_redis.brpoplpush.return_value = b"job-123"
    mock_redis.hgetall.return_value = {b"name": b"test-job", b"data": b"{}"}
    
    job = await consumer._fetch_next_job()
    assert job is not None
    assert job["id"] == "job-123"
    assert job["name"] == "test-job"
    
    mock_redis.brpoplpush.assert_called_with("bull:test-queue:waiting", "bull:test-queue:active", timeout=5)

@pytest.mark.asyncio
async def test_fetch_next_job_no_job(mock_redis):
    consumer = QueueConsumer("test-queue", concurrency=1)
    consumer._redis = mock_redis
    
    mock_redis.brpoplpush.return_value = None
    
    job = await consumer._fetch_next_job()
    assert job is None

@pytest.mark.asyncio
async def test_process_success(mock_redis):
    consumer = QueueConsumer("test-queue", concurrency=1)
    consumer._redis = mock_redis
    
    handler = AsyncMock()
    consumer.register_handler("test-job", handler)
    
    job = {"id": "123", "name": "test-job", "data": '{"foo":"bar"}'}
    await consumer._process(job)
    
    handler.assert_called_once_with({"foo": "bar"})
    mock_redis.lrem.assert_called_once_with("bull:test-queue:active", 1, "123")
    mock_redis.zadd.assert_called_once()

@pytest.mark.asyncio
async def test_process_failure(mock_redis):
    consumer = QueueConsumer("test-queue", concurrency=1)
    consumer._redis = mock_redis
    
    handler = AsyncMock(side_effect=ValueError("Test error"))
    consumer.register_handler("test-job", handler)
    
    job = {"id": "123", "name": "test-job", "data": '{"foo":"bar"}'}
    await consumer._process(job)
    
    mock_redis.lrem.assert_called_once_with("bull:test-queue:active", 1, "123")
    mock_redis.zadd.assert_called_once()
    mock_redis.hset.assert_called_once_with("bull:test-queue:123", "failedReason", "Test error")

@pytest.mark.asyncio
async def test_start_stop_consumer():
    with patch("rosmarium_ai_worker.workers.consumer.consumer.start", new_callable=AsyncMock) as start1, \
         patch("rosmarium_ai_worker.workers.consumer.intelligence_consumer.start", new_callable=AsyncMock) as start2, \
         patch("rosmarium_ai_worker.workers.consumer.consumer.stop", new_callable=AsyncMock) as stop1, \
         patch("rosmarium_ai_worker.workers.consumer.intelligence_consumer.stop", new_callable=AsyncMock) as stop2:
        await start_consumer()
        start1.assert_called_once()
        start2.assert_called_once()
        
        await stop_consumer()
        stop1.assert_called_once()
        stop2.assert_called_once()
