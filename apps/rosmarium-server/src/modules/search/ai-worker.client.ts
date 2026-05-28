/**
 * AI Worker HTTP client — internal use only, never exposed to external clients.
 *
 * Calls rosmarium-ai-worker for query-time embedding at search request time.
 * Uses native fetch (Node 22) with AbortController for timeout enforcement.
 */

import { config } from "../../config.js";
import { logger } from "../../lib/logger.js";

// ─── Error types ──────────────────────────────────────────────────────────────

export class SearchEmbeddingError extends Error {
    public readonly code: string;

    constructor(message: string, code = "EMBEDDING_ERROR") {
        super(message);
        this.name = "SearchEmbeddingError";
        this.code = code;
    }
}

// ─── Response types ───────────────────────────────────────────────────────────

export interface EmbedQueryResponse {
    embedding: number[];
    dimensions: number;
    model: string;
    latencyMs: number;
}

// ─── Client ───────────────────────────────────────────────────────────────────

const EMBED_TIMEOUT_MS = 5_000;

export const aiWorkerClient = {
    /**
     * Embed a search query string via rosmarium-ai-worker.
     * Uses input_type: 'search_query' for providers that distinguish query vs document.
     *
     * Timeout: 5000ms — search must be fast.
     * Throws SearchEmbeddingError on timeout, non-2xx response, or network failure.
     * Note: query text is intentionally NOT logged (PII concern).
     */
    async embedQuery(text: string): Promise<EmbedQueryResponse> {
        const start = Date.now();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), EMBED_TIMEOUT_MS);

        try {
            const response = await fetch(
                `${config.AI_WORKER_URL}/search/embed`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-Worker-Secret": config.AI_WORKER_SECRET,
                    },
                    body: JSON.stringify({ text, input_type: "search_query" }),
                    signal: controller.signal,
                }
            );

            const latencyMs = Date.now() - start;

            if (!response.ok) {
                logger.warn({
                    msg: "ai_worker_embed_request_failed",
                    status: response.status,
                    latency_ms: latencyMs,
                    // query text intentionally omitted
                });
                throw new SearchEmbeddingError(
                    `AI worker returned ${response.status}`,
                    "EMBEDDING_HTTP_ERROR"
                );
            }

            const data = (await response.json()) as {
                embedding: number[];
                dimensions: number;
                model: string;
                latency_ms: number;
            };

            logger.info({
                msg: "ai_worker_embed_request",
                latency_ms: latencyMs,
                model: data.model,
                dimensions: data.dimensions,
            });

            return {
                embedding: data.embedding,
                dimensions: data.dimensions,
                model: data.model,
                latencyMs: data.latency_ms,
            };
        } catch (err) {
            clearTimeout(timeoutId);

            if (err instanceof SearchEmbeddingError) throw err;

            const isTimeout =
                err instanceof Error &&
                (err.name === "AbortError" || err.message.includes("aborted"));

            if (isTimeout) {
                logger.warn({
                    msg: "ai_worker_embed_timeout",
                    timeout_ms: EMBED_TIMEOUT_MS,
                });
                throw new SearchEmbeddingError(
                    `AI worker embed timed out after ${EMBED_TIMEOUT_MS}ms`,
                    "EMBEDDING_TIMEOUT"
                );
            }

            const message = err instanceof Error ? err.message : "Unknown error";
            logger.warn({ msg: "ai_worker_embed_error", error: message });
            throw new SearchEmbeddingError(
                `AI worker embed failed: ${message}`,
                "EMBEDDING_NETWORK_ERROR"
            );
        } finally {
            clearTimeout(timeoutId);
        }
    },

    /**
     * Check if the AI worker is reachable.
     * Returns false if unreachable — does not throw.
     */
    async healthCheck(): Promise<boolean> {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2_000);
            try {
                const response = await fetch(`${config.AI_WORKER_URL}/health`, {
                    signal: controller.signal,
                });
                return response.ok;
            } finally {
                clearTimeout(timeoutId);
            }
        } catch {
            return false;
        }
    },
};
