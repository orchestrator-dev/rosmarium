"""Rosmarium AI Worker — FastAPI application factory with lifespan management."""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.asyncpg import AsyncPGInstrumentor
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from prometheus_fastapi_instrumentator import Instrumentator

from .config import settings
from .database import close_pool, create_pool
from .embedding.registry import init_embedding_provider
from .workers.consumer import start_consumer, stop_consumer

if settings.otel_exporter_otlp_endpoint:
    resource = Resource.create({"service.name": settings.otel_service_name})
    provider = TracerProvider(resource=resource)
    provider.add_span_processor(
        BatchSpanProcessor(OTLPSpanExporter(
            endpoint=settings.otel_exporter_otlp_endpoint)))
    trace.set_tracer_provider(provider)

AsyncPGInstrumentor().instrument()  # type: ignore[no-untyped-call]

logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan — initialise and tear down shared resources."""
    logger.info(
        "starting_rosmarium_ai_worker",
        environment=settings.environment,
        embedding_provider=settings.embedding_provider,
        embedding_model=settings.embedding_model,
    )

    await create_pool()
    await init_embedding_provider()
    await start_consumer()

    yield

    logger.info("shutting_down_rosmarium_ai_worker")
    await stop_consumer()
    await close_pool()


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    from .api.routes import generation, graph, health, intelligence, rag, search, translation

    app = FastAPI(
        title="Rosmarium AI Worker",
        version="0.1.0",
        docs_url="/docs" if settings.environment != "production" else None,
        lifespan=lifespan,
    )

    FastAPIInstrumentor.instrument_app(app)
    Instrumentator().instrument(app).expose(app, endpoint='/metrics')

    app.include_router(health.router, tags=["health"])
    app.include_router(search.router, prefix="/search", tags=["search"])
    app.include_router(rag.router, prefix="/rag", tags=["rag"])
    app.include_router(intelligence.router, prefix="/intelligence", tags=["intelligence"])
    app.include_router(graph.router, prefix="/graph", tags=["graph"])
    app.include_router(generation.router, prefix="/generation", tags=["generation"])
    app.include_router(translation.router, prefix="/translation", tags=["translation"])

    return app


app = create_app()
