"""asyncpg connection pool management for shared PostgreSQL access."""

from collections.abc import AsyncGenerator

import asyncpg
import structlog

from .config import settings

logger = structlog.get_logger(__name__)

_pool: asyncpg.Pool | None = None


async def create_pool() -> asyncpg.Pool:
    """Create and return the asyncpg connection pool."""
    global _pool
    logger.info("creating_db_pool", dsn=settings.database_url.split("@")[-1])
    _pool = await asyncpg.create_pool(
        dsn=settings.database_url,
        min_size=2,
        max_size=10,
        command_timeout=30,
    )
    return _pool


async def get_pool() -> asyncpg.Pool:
    """Return the initialised pool or raise if not yet created."""
    if _pool is None:
        raise RuntimeError("Database pool not initialised — call create_pool() first")
    return _pool


async def close_pool() -> None:
    """Close the connection pool gracefully."""
    global _pool
    if _pool:
        logger.info("closing_db_pool")
        await _pool.close()
        _pool = None


async def get_db() -> AsyncGenerator[asyncpg.Connection, None]:
    """FastAPI dependency — yields a connection from the pool."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        yield conn
