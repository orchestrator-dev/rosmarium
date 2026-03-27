"""Health and readiness endpoints for rosmarium-ai-worker."""

import asyncio
from typing import Any

import redis.asyncio as aioredis
import structlog
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from ...config import settings
from ...database import get_pool
from ...embedding.registry import get_provider

logger = structlog.get_logger(__name__)

router = APIRouter()


class HealthResponse(BaseModel):
    """Liveness check response."""

    status: str
    service: str


class CheckResult(BaseModel):
    """Individual dependency check result."""

    postgres: str
    redis: str
    embedding: str


class ReadyResponse(BaseModel):
    """Readiness check response."""

    status: str
    checks: CheckResult


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Liveness probe — always returns 200 if the process is running."""
    return HealthResponse(status="ok", service="rosmarium-ai-worker")


@router.get("/ready", response_model=ReadyResponse)
async def readiness_check() -> Any:
    """Readiness probe — checks PostgreSQL, Redis, and embedding provider.

    Returns 200 if all deps are healthy, 503 if any fail.
    """

    async def check_postgres() -> str:
        try:
            pool = await get_pool()
            async with pool.acquire() as conn:
                await conn.execute("SELECT 1")
            return "ok"
        except Exception as e:
            logger.warning("readiness_postgres_failed", error=str(e))
            return str(e)

    async def check_redis() -> str:
        try:
            client = aioredis.from_url(settings.redis_url)
            try:
                await client.ping()  # type: ignore[misc]
                return "ok"
            finally:
                await client.aclose()
        except Exception as e:
            logger.warning("readiness_redis_failed", error=str(e))
            return str(e)

    async def check_embedding() -> str:
        try:
            provider = get_provider()
            healthy = await provider.health_check()
            return "ok" if healthy else "provider unhealthy"
        except Exception as e:
            logger.warning("readiness_embedding_failed", error=str(e))
            return str(e)

    postgres_result, redis_result, embedding_result = await asyncio.gather(
        check_postgres(),
        check_redis(),
        check_embedding(),
    )

    checks = CheckResult(
        postgres=postgres_result,
        redis=redis_result,
        embedding=embedding_result,
    )

    all_ok = all(v == "ok" for v in [postgres_result, redis_result, embedding_result])

    response = ReadyResponse(
        status="ready" if all_ok else "unavailable",
        checks=checks,
    )

    if not all_ok:
        return JSONResponse(
            status_code=503,
            content=response.model_dump(),
        )

    return response
