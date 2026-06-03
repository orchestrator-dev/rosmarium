import json
import time
import uuid
from typing import Any

import redis.asyncio as aioredis
import structlog
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

from ...config import settings
from ...database import get_pool
from ...graph.exporter import exporter
from .intelligence import require_worker_secret

logger = structlog.get_logger(__name__)
router = APIRouter()

class ComputeAnalyticsRequest(BaseModel):
    contentType: str | None = None  # noqa: N815

@router.post(
    "/analytics/compute",
    dependencies=[Depends(require_worker_secret)],
    status_code=202,
    summary="Trigger graph analytics computation",
)
async def compute_analytics(request: ComputeAnalyticsRequest) -> dict[str, Any]:
    job_id = str(uuid.uuid4())
    job_data = {
        "contentType": request.contentType,
        "requestedBy": "api",
    }
    
    redis = aioredis.from_url(settings.redis_url)
    queue = "intelligence-jobs"
    job_name = "compute-graph-analytics"
    
    job_key = f"bull:{queue}:{job_id}"
    await redis.hset(job_key, mapping={  # type: ignore[misc]
        "name": job_name,
        "data": json.dumps(job_data),
        "timestamp": str(int(time.time() * 1000)),
        "opts": "{}",
    })
    
    await redis.lpush(f"bull:{queue}:waiting", job_id)  # type: ignore[misc]
    await redis.aclose()
    
    return {"status": "queued", "message": "Graph analytics computation queued."}

@router.get(
    "/analytics/{entry_id}",
    dependencies=[Depends(require_worker_secret)],
    summary="Get analytics for a specific entry",
)
async def get_entry_analytics(entry_id: str) -> dict[str, Any]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT metadata FROM content_entries WHERE id = $1",
            entry_id
        )
        
        if not row:
            raise HTTPException(status_code=404, detail="Entry not found")
            
        metadata = row["metadata"]
        if not metadata:
            raise HTTPException(status_code=404, detail="Analytics not yet computed")
            
        meta_dict = json.loads(metadata) if isinstance(metadata, str) else metadata
        graph_data = meta_dict.get("graph")
        
        if not graph_data:
            raise HTTPException(status_code=404, detail="Analytics not yet computed")
            
        return dict(graph_data)

@router.get(
    "/export",
    dependencies=[Depends(require_worker_secret)],
    summary="Export knowledge graph",
    response_model=None,
)
async def export_graph(
    format: str = Query(..., description="'json-ld' | 'rdf' | 'cytoscape' | 'graphml'"),  # noqa: A002
    contentType: str | None = None,  # noqa: N803
    includeAnalytics: bool = True,  # noqa: N803
) -> StreamingResponse | JSONResponse:
    pool = await get_pool()
    async with pool.acquire() as conn:
        if format == "json-ld":
            data_json = await exporter.export_json_ld(contentType, conn)
            return JSONResponse(content=data_json, media_type="application/ld+json")
        elif format == "rdf":
            data_rdf = await exporter.export_rdf_turtle(contentType, conn)
            return StreamingResponse(iter([data_rdf.encode()]), media_type="text/turtle")
        elif format == "cytoscape":
            data_cy = await exporter.export_cytoscape(contentType, conn, includeAnalytics)
            return JSONResponse(content=data_cy, media_type="application/json")
        elif format == "graphml":
            data_gml = await exporter.export_graphml(contentType, conn)
            return StreamingResponse(iter([data_gml.encode()]), media_type="application/xml")
        else:
            raise HTTPException(status_code=400, detail="Invalid format specified")
