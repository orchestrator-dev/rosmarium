"""Cortex AI Worker — FastAPI application factory with lifespan management."""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI

from .config import settings
from .database import close_pool, create_pool
from .embedding.registry import init_embedding_provider
from .workers.consumer import start_consumer, stop_consumer

logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan — initialise and tear down shared resources."""
    logger.info(
        "starting_cortex_ai_worker",
        environment=settings.environment,
        embedding_provider=settings.embedding_provider,
        embedding_model=settings.embedding_model,
    )

    await create_pool()
    await init_embedding_provider()
    await start_consumer()

    yield

    logger.info("shutting_down_cortex_ai_worker")
    await stop_consumer()
    await close_pool()


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    from .api.routes import health, intelligence, rag, search

    app = FastAPI(
        title="Cortex AI Worker",
        version="0.1.0",
        docs_url="/docs" if settings.environment != "production" else None,
        lifespan=lifespan,
    )

    app.include_router(health.router, tags=["health"])
    app.include_router(search.router, prefix="/search", tags=["search"])
    app.include_router(rag.router, prefix="/rag", tags=["rag"])
    app.include_router(intelligence.router, prefix="/intelligence", tags=["intelligence"])

    return app


app = create_app()
