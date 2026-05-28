/**
 * HTTP client for the rosmarium-ai-worker RAG endpoints.
 *
 * Provides:
 *   ragClient.retrieve()       — POST /rag/retrieve  (JSON)
 *   ragClient.retrieveStream() — POST /rag/retrieve/stream  (SSE)
 */

import { config } from "../../config.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RagRetrieveRequest {
    query: string;
    contentTypes: string[];
    allowedEntryIds: string[];
    topK?: number;
    rerank?: boolean;
    includeMetadata?: boolean;
}

export interface RagChunk {
    contentEntryId: string;
    contentType: string;
    chunkIndex: number;
    chunkText: string;
    score: number;
    freshnessScore: number;
    publishedAt: string | null;
    metadata: Record<string, unknown>;
}

export interface RagRetrieveResponse {
    chunks: RagChunk[];
    query: string;
    total: number;
    latencyMs: number;
    reranked: boolean;
}

export interface RagChunkEvent {
    type: "chunk";
    chunkIndex: number;
    contentEntryId: string;
    contentType: string;
    chunkText: string;
    score: number;
    freshnessScore: number;
    publishedAt: string | null;
    metadata: Record<string, unknown>;
}

export interface RagDoneEvent {
    type: "done";
    total: number;
    latencyMs: number;
    reranked: boolean;
}

export interface RagErrorEvent {
    type: "error";
    error: string;
}

export type RagStreamEvent = RagChunkEvent | RagDoneEvent | RagErrorEvent;

// ─── Error ────────────────────────────────────────────────────────────────────

export class RagRetrievalError extends Error {
    constructor(
        message: string,
        public readonly statusCode?: number
    ) {
        super(message);
        this.name = "RagRetrievalError";
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const RAG_TIMEOUT_MS = 15_000;

function buildWorkerBody(request: RagRetrieveRequest): Record<string, unknown> {
    return {
        query: request.query,
        content_types: request.contentTypes,
        allowed_entry_ids: request.allowedEntryIds,
        top_k: request.topK ?? 10,
        rerank: request.rerank ?? false,
        include_metadata: request.includeMetadata ?? true,
    };
}

/** Map snake_case worker chunk to camelCase. */
function mapChunk(raw: Record<string, unknown>): RagChunk {
    return {
        contentEntryId: String(raw["content_entry_id"] ?? ""),
        contentType: String(raw["content_type"] ?? ""),
        chunkIndex: Number(raw["chunk_index"] ?? 0),
        chunkText: String(raw["chunk_text"] ?? ""),
        score: Number(raw["score"] ?? 0),
        freshnessScore: Number(raw["freshness_score"] ?? 0),
        publishedAt: raw["published_at"] != null ? String(raw["published_at"]) : null,
        metadata: (raw["metadata"] as Record<string, unknown>) ?? {},
    };
}

// ─── Client ───────────────────────────────────────────────────────────────────

export const ragClient = {
    /**
     * POST /rag/retrieve — synchronous JSON retrieval.
     *
     * Timeout: 15 000 ms.
     * Throws RagRetrievalError on HTTP error or network failure.
     */
    async retrieve(request: RagRetrieveRequest): Promise<RagRetrieveResponse> {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), RAG_TIMEOUT_MS);

        try {
            const res = await fetch(`${config.AI_WORKER_URL}/rag/retrieve`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Worker-Secret": config.AI_WORKER_SECRET,
                },
                body: JSON.stringify(buildWorkerBody(request)),
                signal: controller.signal,
            });

            if (!res.ok) {
                const text = await res.text().catch(() => "");
                throw new RagRetrievalError(
                    `AI worker returned ${res.status}: ${text}`,
                    res.status
                );
            }

            const data = (await res.json()) as Record<string, unknown>;
            const rawChunks = (data["chunks"] as Record<string, unknown>[]) ?? [];

            return {
                chunks: rawChunks.map(mapChunk),
                query: String(data["query"] ?? request.query),
                total: Number(data["total"] ?? 0),
                latencyMs: Number(data["latency_ms"] ?? 0),
                reranked: Boolean(data["reranked"] ?? false),
            };
        } catch (err) {
            if ((err as Error).name === "AbortError") {
                throw new RagRetrievalError("RAG retrieve request timed out after 15 s");
            }
            if (err instanceof RagRetrievalError) throw err;
            throw new RagRetrievalError(`RAG retrieve failed: ${String(err)}`);
        } finally {
            clearTimeout(timer);
        }
    },

    /**
     * POST /rag/retrieve/stream — Server-Sent Events streaming retrieval.
     *
     * Yields RagChunkEvent for each chunk, RagDoneEvent when complete.
     * Generator closes on 'done' event or 'error' event.
     */
    async *retrieveStream(
        request: RagRetrieveRequest
    ): AsyncGenerator<RagStreamEvent> {
        const res = await fetch(`${config.AI_WORKER_URL}/rag/retrieve/stream`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Worker-Secret": config.AI_WORKER_SECRET,
            },
            body: JSON.stringify(buildWorkerBody(request)),
        });

        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new RagRetrievalError(`AI worker stream returned ${res.status}: ${text}`, res.status);
        }

        if (!res.body) {
            throw new RagRetrievalError("AI worker stream response has no body");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let currentEvent = "";

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() ?? "";

                for (const line of lines) {
                    if (line.startsWith("event: ")) {
                        currentEvent = line.slice(7).trim();
                    } else if (line.startsWith("data: ")) {
                        const raw = JSON.parse(line.slice(6)) as Record<string, unknown>;

                        if (currentEvent === "chunk") {
                            yield {
                                type: "chunk",
                                chunkIndex: Number(raw["chunk_index"] ?? 0),
                                contentEntryId: String(raw["content_entry_id"] ?? ""),
                                contentType: String(raw["content_type"] ?? ""),
                                chunkText: String(raw["chunk_text"] ?? ""),
                                score: Number(raw["score"] ?? 0),
                                freshnessScore: Number(raw["freshness_score"] ?? 0),
                                publishedAt: raw["published_at"] != null ? String(raw["published_at"]) : null,
                                metadata: (raw["metadata"] as Record<string, unknown>) ?? {},
                            } satisfies RagChunkEvent;
                        } else if (currentEvent === "done") {
                            yield {
                                type: "done",
                                total: Number(raw["total"] ?? 0),
                                latencyMs: Number(raw["latency_ms"] ?? 0),
                                reranked: Boolean(raw["reranked"] ?? false),
                            } satisfies RagDoneEvent;
                            return; // close generator on done
                        } else if (currentEvent === "error") {
                            yield {
                                type: "error",
                                error: String(raw["error"] ?? "Unknown error"),
                            } satisfies RagErrorEvent;
                            return;
                        }

                        currentEvent = "";
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }
    },
};
