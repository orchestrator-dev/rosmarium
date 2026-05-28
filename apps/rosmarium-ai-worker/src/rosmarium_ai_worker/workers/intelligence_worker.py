"""Intelligence job processor — consumes 'analyse-content' jobs from intelligence-jobs queue.

Runs auto-tagging, NER, summarization, and duplicate detection based on
the operations list in the job payload. Each operation is independent —
failures in one do not block others. Results are written to
content_entries.metadata JSONB under the 'ai' key.
"""

from __future__ import annotations

import json
from typing import Any

import structlog
from pydantic import BaseModel

from ..database import get_pool
from ..graph.inference import inference_engine
from ..intelligence.duplicate_detector import duplicate_detector
from ..intelligence.ner import ner_extractor
from ..intelligence.summarizer import content_summarizer
from ..intelligence.tagger import auto_tagger

logger = structlog.get_logger(__name__)



class AnalyseJobPayload(BaseModel):
    """Validated payload for an analyse-content job."""

    contentEntryId: str
    contentType: str
    fields: list[dict[str, Any]]
    locale: str
    candidateLabels: list[str] = []
    operations: list[str] = ["tag", "ner", "deduplicate"]


async def process_intelligence_job(raw_payload: dict[str, Any]) -> None:
    """Process an intelligence analysis job.

    Steps:
    1. Validate payload
    2. Concatenate field texts
    3. Run requested operations independently (partial success is fine)
    4. Write results back to content_entries.metadata
    """
    payload = AnalyseJobPayload.model_validate(raw_payload)

    # Concatenate field texts (same pattern as embedding_worker)
    text = " ".join(
        f"{f['fieldName']}: {f['text']}"
        for f in payload.fields
        if f.get("text") and str(f.get("text", "")).strip()
    )
    if not text.strip():
        logger.info(
            "intelligence_job_empty_text",
            entry_id=payload.contentEntryId,
            content_type=payload.contentType,
        )
        return

    results: dict[str, Any] = {}
    ops = set(payload.operations)

    # ── Auto-tagging ──────────────────────────────────────────────────────────
    if "tag" in ops and payload.candidateLabels:
        try:
            tags = await auto_tagger.tag_async(text, payload.candidateLabels)
            results["tags"] = [t.model_dump() for t in tags]
        except Exception as e:
            logger.warning(
                "tagging_failed",
                entry_id=payload.contentEntryId,
                error=str(e),
            )

    # ── Named entity recognition ───────────────────────────────────────────────
    if "ner" in ops:
        try:
            entities = await ner_extractor.extract_async(text)
            results["entities"] = ner_extractor.to_dict(entities)
        except Exception as e:
            logger.warning(
                "ner_failed",
                entry_id=payload.contentEntryId,
                error=str(e),
            )

    # ── Summarization ─────────────────────────────────────────────────────────
    if "summarize" in ops:
        try:
            summary = await content_summarizer.summarize(text)
            results["summary"] = summary.summary
            results["summaryMeta"] = summary.model_dump(exclude={"summary"})
        except Exception as e:
            logger.warning(
                "summarize_failed",
                entry_id=payload.contentEntryId,
                error=str(e),
            )

    # ── Duplicate detection ────────────────────────────────────────────────────
    if "deduplicate" in ops:
        try:
            pool = await get_pool()
            async with pool.acquire() as conn:
                table = f"rosmarium_{payload.contentType}_embeddings"
                row = await conn.fetchrow(
                    f"SELECT embedding FROM {table} WHERE content_entry_id = $1 LIMIT 1",
                    payload.contentEntryId,
                )
                if row:
                    embedding = list(row["embedding"])
                    dupes = await duplicate_detector.find_duplicates(
                        payload.contentEntryId,
                        payload.contentType,
                        embedding,
                        conn,
                    )
                    results["duplicates"] = [d.model_dump() for d in dupes]
        except Exception as e:
            logger.warning(
                "dedup_failed",
                entry_id=payload.contentEntryId,
                error=str(e),
            )

    # Write partial or full results to content_entries.metadata
    if results:
        from datetime import UTC, datetime

        results["analysedAt"] = datetime.now(tz=UTC).isoformat()

        pool = await get_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                """
                UPDATE content_entries
                SET metadata = COALESCE(metadata, '{}') || $1::jsonb,
                    updated_at = now()
                WHERE id = $2
                """,
                json.dumps({"ai": results}),
                payload.contentEntryId,
            )

        logger.info(
            "intelligence_complete",
            entry_id=payload.contentEntryId,
            operations=sorted(ops),
            tags_count=len(results.get("tags", [])),
            entities_count=sum(
                len(v) for v in results.get("entities", {}).values()
                if isinstance(v, list)
            ),
            has_duplicates=any(
                d.get("is_duplicate", False)
                for d in results.get("duplicates", [])
            ),
        )

    # ── Graph inference ───────────────────────────────────────────────────────
    # Runs after intelligence results are persisted. Reads graph settings directly
    # from the content_types table to avoid an HTTP round-trip.
    pool = await get_pool()
    async with pool.acquire() as conn:
        ct_row = await conn.fetchrow(
            """
            SELECT settings
            FROM content_types
            WHERE name = $1
              AND archived_at IS NULL
            """,
            payload.contentType,
        )

    if ct_row is not None:
        import json as _json

        raw_settings: dict[str, Any] = _json.loads(ct_row["settings"] or "{}")
        graph_settings: dict[str, Any] = raw_settings.get("graph", {})

        if graph_settings.get("enabled", False):
            ner_results: dict[str, list[str]] | None = results.get("entities")
            async with pool.acquire() as graph_conn:
                try:
                    await inference_engine.run_all(
                        entry_id=payload.contentEntryId,
                        content_type=payload.contentType,
                        ner_results=ner_results,
                        text_content=text,
                        graph_settings=graph_settings,
                        conn=graph_conn,
                    )
                except Exception as exc:
                    logger.warning(
                        "graph_inference_failed",
                        entry_id=payload.contentEntryId,
                        error=str(exc),
                    )

