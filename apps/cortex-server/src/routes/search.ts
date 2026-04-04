/**
 * Search REST API routes.
 *
 * GET /api/search         — hybrid BM25 + vector search with RRF
 * GET /api/search/suggest — prefix autocomplete for search input
 *
 * Both require authentication (session cookie or Bearer API key).
 */

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { requireAuth } from "../modules/rbac/rbac.middleware.js";
import { searchService } from "../modules/search/search.service.js";
import type { AuthenticatedUser } from "../modules/auth/auth.service.js";

// ─── Query param types ────────────────────────────────────────────────────────

interface SearchQuery {
    q: string;
    contentType?: string;
    locale?: string;
    status?: string;
    alpha?: string;
    limit?: string;
}

interface SuggestQuery {
    q: string;
    contentType?: string;
    limit?: string;
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

const searchRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
    // GET /api/search/suggest — must be registered before /api/search to avoid :wildcard matching
    app.get<{ Querystring: SuggestQuery }>(
        "/api/search/suggest",
        {
            preHandler: requireAuth(),
            schema: {
                tags: ["Search"],
                summary: "Autocomplete title suggestions",
                querystring: {
                    type: "object",
                    required: ["q"],
                    properties: {
                        q: { type: "string", minLength: 1 },
                        contentType: { type: "string" },
                        limit: { type: "string" },
                    },
                },
                response: {
                    200: {
                        type: "object",
                        properties: {
                            data: { type: "array", items: { type: "string" } },
                        },
                    },
                },
            },
        },
        async (request, reply) => {
            try {
                const limit = request.query.limit
                    ? Math.min(parseInt(request.query.limit, 10) || 5, 20)
                    : 5;

                const suggestions = await searchService.suggest({
                    query: request.query.q,
                    contentType: request.query.contentType,
                    limit,
                });

                return { data: suggestions };
            } catch (err) {
                const message = err instanceof Error ? err.message : "Unknown error";
                return reply.status(400).send({ error: { code: "BAD_REQUEST", message } });
            }
        }
    );

    // GET /api/search
    app.get<{ Querystring: SearchQuery }>(
        "/api/search",
        {
            preHandler: requireAuth(),
            schema: {
                tags: ["Search"],
                summary: "Hybrid BM25 + vector search with Reciprocal Rank Fusion",
                querystring: {
                    type: "object",
                    required: ["q"],
                    properties: {
                        q: { type: "string", minLength: 1, maxLength: 500 },
                        contentType: { type: "string" },
                        locale: { type: "string" },
                        status: {
                            type: "string",
                            enum: ["draft", "published", "archived"],
                        },
                        alpha: { type: "string" },
                        limit: { type: "string" },
                    },
                },
                response: {
                    200: {
                        type: "object",
                        properties: {
                            data: { type: "array" },
                            meta: {
                                type: "object",
                                properties: {
                                    query: { type: "string" },
                                    total: { type: "integer" },
                                    alpha: { type: "number" },
                                    contentTypes: { type: "array", items: { type: "string" } },
                                    latencyMs: { type: "integer" },
                                    embeddingProvider: { type: ["string", "null"] },
                                },
                            },
                        },
                    },
                },
            },
        },
        async (request, reply) => {
            try {
                const q = request.query.q?.trim();
                if (!q) {
                    return reply.status(400).send({
                        error: { code: "BAD_REQUEST", message: "Query parameter 'q' is required" },
                    });
                }

                const alpha = request.query.alpha
                    ? Math.min(1, Math.max(0, parseFloat(request.query.alpha) || 0.5))
                    : 0.5;
                const limit = request.query.limit
                    ? Math.min(50, Math.max(1, parseInt(request.query.limit, 10) || 10))
                    : 10;

                // request.user is guaranteed non-null after requireAuth()
                const user = request.user as AuthenticatedUser;

                const result = await searchService.search({
                    query: q,
                    contentType: request.query.contentType,
                    locale: request.query.locale,
                    status: request.query.status,
                    alpha,
                    limit,
                    user,
                });

                return result;
            } catch (err) {
                const message = err instanceof Error ? err.message : "Unknown error";
                request.log.error({ msg: "search_error", error: message });
                return reply.status(500).send({
                    error: { code: "INTERNAL_SERVER_ERROR", message: "Search failed" },
                });
            }
        }
    );
};

export default fp(searchRoutes, { name: "search-routes" });
