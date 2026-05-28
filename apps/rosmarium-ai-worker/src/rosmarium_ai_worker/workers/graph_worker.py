from typing import Any

import structlog
from pydantic import BaseModel

from ..database import get_pool
from ..graph.analytics import analytics_engine

log = structlog.get_logger(__name__)

class AnalyticsJobPayload(BaseModel):
    contentType: str | None = None  # noqa: N815
    requestedBy: str  # noqa: N815

async def process_analytics_job(raw_payload: dict[str, Any]) -> None:
    payload = AnalyticsJobPayload.model_validate(raw_payload)
    pool = await get_pool()
    async with pool.acquire() as conn:
        results = await analytics_engine.compute_analytics(payload.contentType, conn)
        await analytics_engine.write_analytics_results(results, conn)
    log.info(
        "analytics_complete",
        content_type=payload.contentType,
        nodes_computed=len(results),
    )
