/**
 * RAG REST API routes.
 *
 * POST /api/rag/retrieve        — synchronous JSON retrieval
 * POST /api/rag/retrieve/stream — SSE streaming retrieval
 *
 * Both require authentication (session cookie or Bearer API key).
 */

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { requireAuth } from "../modules/rbac/rbac.middleware.js";
import { ragService } from "../modules/rag/rag.service.js";
import type { AuthenticatedUser } from "../modules/auth/auth.service.js";
import type { RagFormat } from "../modules/rag/rag.service.js";

// ─── Body types ───────────────────────────────────────────────────────────────

interface RagRetrieveBody {
    query: string;
    contentTypes?: string[];
    topK?: number;
    rerank?: boolean;
    format?: RagFormat;
    maxTokens?: number;
}

interface RagStreamBody {
    query: string;
    contentTypes?: string[];
    topK?: number;
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

const ragRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
    // POST /api/rag/retrieve — synchronous JSON
    app.post<{ Body: RagRetrieveBody }>(
        "/api/rag/retrieve",
        {
            preHandler: requireAuth(),
            schema: {
                tags: ["RAG"],
                summary: "Retrieve semantically relevant chunks for a query",
                body: {
                    type: "object",
                    required: ["query"],
                    properties: {
                        query: { type: "string", minLength: 1, maxLength: 1000 },
                        contentTypes: {
                            type: "array",
                            items: { type: "string" },
                        },
                        topK: { type: "integer", minimum: 1, maximum: 50, default: 10 },
                        rerank: { type: "boolean", default: false },
                        format: {
                            type: "string",
                            enum: ["chunks", "context", "json"],
                            default: "chunks",
                        },
                        maxTokens: { type: "integer", minimum: 100, maximum: 32000, default: 4000 },
                    },
                },
            },
        },
        async (request, reply) => {
            try {
                const user = request.user as AuthenticatedUser;
                const body = request.body;

                const result = await ragService.retrieve({
                    query: body.query,
                    contentTypes: body.contentTypes,
                    topK: body.topK,
                    rerank: body.rerank,
                    format: body.format,
                    maxTokens: body.maxTokens,
                    user,
                });

                return { data: result };
            } catch (err) {
                const message = err instanceof Error ? err.message : "Unknown error";
                request.log.error({ msg: "rag_retrieve_error", error: message });

                if (message.includes("required") || message.includes("exceeds maximum")) {
                    return reply.status(400).send({
                        error: { code: "BAD_REQUEST", message },
                    });
                }

                return reply.status(500).send({
                    error: { code: "INTERNAL_SERVER_ERROR", message: "RAG retrieval failed" },
                });
            }
        }
    );

    // POST /api/rag/retrieve/stream — SSE streaming
    app.post<{ Body: RagStreamBody }>(
        "/api/rag/retrieve/stream",
        {
            preHandler: requireAuth(),
            schema: {
                tags: ["RAG"],
                summary: "Stream RAG retrieval as Server-Sent Events",
                body: {
                    type: "object",
                    required: ["query"],
                    properties: {
                        query: { type: "string", minLength: 1, maxLength: 1000 },
                        contentTypes: {
                            type: "array",
                            items: { type: "string" },
                        },
                        topK: { type: "integer", minimum: 1, maximum: 50, default: 10 },
                    },
                },
            },
        },
        async (request, reply) => {
            const user = request.user as AuthenticatedUser;
            const body = request.body;

            // Set SSE headers before streaming
            void reply.raw.writeHead(200, {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
                Connection: "keep-alive",
            });

            try {
                const generator = ragService.retrieveStream({
                    query: body.query,
                    contentTypes: body.contentTypes,
                    topK: body.topK,
                    user,
                });

                for await (const event of generator) {
                    if (event.type === "chunk") {
                        const payload = JSON.stringify({
                            chunk_index: event.chunkIndex,
                            content_entry_id: event.contentEntryId,
                            content_type: event.contentType,
                            chunk_text: event.chunkText,
                            score: event.score,
                            freshness_score: event.freshnessScore,
                            published_at: event.publishedAt,
                            metadata: event.metadata,
                        });
                        reply.raw.write(`event: chunk\ndata: ${payload}\n\n`);
                    } else if (event.type === "done") {
                        const payload = JSON.stringify({
                            total: event.total,
                            latency_ms: event.latencyMs,
                            reranked: event.reranked,
                        });
                        reply.raw.write(`event: done\ndata: ${payload}\n\n`);
                    } else if (event.type === "error") {
                        const payload = JSON.stringify({ error: event.error });
                        reply.raw.write(`event: error\ndata: ${payload}\n\n`);
                    }
                }
            } catch (err) {
                const message = err instanceof Error ? err.message : "Unknown error";
                request.log.error({ msg: "rag_stream_error", error: message });
                reply.raw.write(
                    `event: error\ndata: ${JSON.stringify({ error: message })}\n\n`
                );
            } finally {
                reply.raw.end();
            }
        }
    );
};

export default fp(ragRoutes, { name: "rag-routes" });
