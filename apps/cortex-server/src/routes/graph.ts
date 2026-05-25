/**
 * Graph REST routes — /api/graph
 *
 * POST   /api/graph/edges              — create a manual edge
 * DELETE /api/graph/edges/:id          — delete an edge
 * GET    /api/graph/edges/:entryId     — list edges for an entry
 * POST   /api/graph/edges/:id/accept   — accept a pending edge
 * POST   /api/graph/edges/:id/reject   — reject a pending edge
 * GET    /api/graph/pending            — list all pending edges
 * GET    /api/graph/entities           — list entity nodes
 * GET    /api/graph/entities/:entryId/mentions — entity mentions for an entry
 */

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth, requirePermission, requireRole } from "../modules/rbac/rbac.middleware.js";
import { PERMISSIONS } from "../modules/rbac/permissions.js";
import { graphService, GraphValidationError } from "../modules/graph/graph.service.js";
import { traverse } from "../modules/graph/traversal/traversal.engine.js";
import { findShortestPath } from "../modules/graph/traversal/path.finder.js";
import { getRecommendations } from "../modules/graph/traversal/recommender.js";
import { executeCypher } from "../modules/graph/traversal/cypher.parser.js";

// ─── Zod schemas ─────────────────────────────────────────────────────────────

const createEdgeBody = z.object({
    fromEntryId: z.string().min(1),
    fromContentType: z.string().min(1),
    toEntryId: z.string().min(1),
    toContentType: z.string().min(1),
    edgeType: z.string().min(1),
    weight: z.number().min(0).max(1).optional(),
    properties: z.record(z.unknown()).optional(),
});

const getEdgesQuery = z.object({
    direction: z.enum(["outbound", "inbound", "both"]).optional(),
    edgeType: z.string().optional(),
    minWeight: z.coerce.number().optional(),
    status: z.enum(["pending", "accepted", "rejected", "all"]).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
});

const getEntitiesQuery = z.object({
    entityType: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(500).optional(),
});

const traverseQuery = z.object({
    from: z.string().min(1),
    depth: z.coerce.number().int().min(1).max(5).optional(),
    edgeType: z.string().optional(),
    direction: z.enum(["outbound", "inbound", "both"]).optional(),
    minWeight: z.coerce.number().optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
    populate: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
});

const pathQuery = z.object({
    from: z.string().min(1),
    to: z.string().min(1),
    edgeType: z.string().optional(),
    maxDepth: z.coerce.number().int().min(1).max(5).optional(),
});

const recommendQuery = z.object({
    id: z.string().min(1),
    contentType: z.string().min(1),
    limit: z.coerce.number().int().min(1).max(50).optional(),
});

const queryBody = z.object({
    query: z.string().min(1),
});

const visualizeQuery = z.object({
    rootId: z.string().min(1),
    depth: z.coerce.number().int().min(1).max(5).optional(),
    edgeType: z.string().optional(),
});

// ─── Route handler ────────────────────────────────────────────────────────────

export default async function graphRoutes(app: FastifyInstance) {
    // POST /api/graph/edges
    app.post(
        "/api/graph/edges",
        { preHandler: requirePermission(PERMISSIONS.CONTENT_UPDATE_ANY) },
        async (request, reply) => {
            const parsed = createEdgeBody.safeParse(request.body);
            if (!parsed.success) {
                return reply.status(400).send({
                    error: { code: "VALIDATION_ERROR", message: parsed.error.message },
                });
            }

            try {
                const edge = await graphService.createEdge({
                    ...parsed.data,
                    source: "manual",
                    isAccepted: "accepted",
                    createdBy: request.user?.id ?? null,
                });
                return reply.status(201).send({ data: edge });
            } catch (err) {
                if (err instanceof GraphValidationError) {
                    return reply.status(422).send({
                        error: { code: "GRAPH_VALIDATION_ERROR", message: err.message },
                    });
                }
                throw err;
            }
        },
    );

    // DELETE /api/graph/edges/:id
    app.delete<{ Params: { id: string } }>(
        "/api/graph/edges/:id",
        { preHandler: requirePermission(PERMISSIONS.CONTENT_UPDATE_ANY) },
        async (request, reply) => {
            await graphService.deleteEdge(request.params.id);
            return reply.status(204).send();
        },
    );

    // GET /api/graph/edges/:entryId
    app.get<{ Params: { entryId: string } }>(
        "/api/graph/edges/:entryId",
        { preHandler: requireAuth() },
        async (request, reply) => {
            const parsed = getEdgesQuery.safeParse(request.query);
            if (!parsed.success) {
                return reply.status(400).send({
                    error: { code: "VALIDATION_ERROR", message: parsed.error.message },
                });
            }

            const edges = await graphService.getEdgesForEntry({
                entryId: request.params.entryId,
                ...parsed.data,
            });

            return reply.send({ data: edges, meta: { total: edges.length } });
        },
    );

    // POST /api/graph/edges/:id/accept
    app.post<{ Params: { id: string } }>(
        "/api/graph/edges/:id/accept",
        { preHandler: requirePermission(PERMISSIONS.CONTENT_UPDATE_ANY) },
        async (request, reply) => {
            const edge = await graphService.acceptEdge(request.params.id);
            if (!edge) {
                return reply.status(404).send({
                    error: { code: "NOT_FOUND", message: "Edge not found" },
                });
            }
            return reply.send({ data: edge });
        },
    );

    // POST /api/graph/edges/:id/reject
    app.post<{ Params: { id: string } }>(
        "/api/graph/edges/:id/reject",
        { preHandler: requirePermission(PERMISSIONS.CONTENT_UPDATE_ANY) },
        async (request, reply) => {
            const edge = await graphService.rejectEdge(request.params.id);
            if (!edge) {
                return reply.status(404).send({
                    error: { code: "NOT_FOUND", message: "Edge not found" },
                });
            }
            return reply.send({ data: edge });
        },
    );

    // GET /api/graph/pending
    app.get<{ Querystring: { limit?: string } }>(
        "/api/graph/pending",
        { preHandler: requireRole("editor", "admin", "super_admin") },
        async (request, reply) => {
            const limit = Math.min(
                200,
                parseInt(String(request.query.limit ?? "50"), 10) || 50,
            );
            const edges = await graphService.getPendingEdges(limit);
            return reply.send({ data: edges, meta: { total: edges.length } });
        },
    );

    // GET /api/graph/entities
    app.get(
        "/api/graph/entities",
        { preHandler: requireAuth() },
        async (request, reply) => {
            const parsed = getEntitiesQuery.safeParse(request.query);
            if (!parsed.success) {
                return reply.status(400).send({
                    error: { code: "VALIDATION_ERROR", message: parsed.error.message },
                });
            }

            const entities = await graphService.getEntityNodes(parsed.data);
            return reply.send({ data: entities, meta: { total: entities.length } });
        },
    );

    // GET /api/graph/entities/:entryId/mentions
    app.get<{ Params: { entryId: string } }>(
        "/api/graph/entities/:entryId/mentions",
        { preHandler: requireAuth() },
        async (request, reply) => {
            const mentions = await graphService.getEntityMentions(
                request.params.entryId,
            );
            return reply.send({ data: mentions, meta: { total: mentions.length } });
        },
    );

    // GET /api/graph/traverse
    app.get(
        "/api/graph/traverse",
        { preHandler: requireAuth() },
        async (request, reply) => {
            const parsed = traverseQuery.safeParse(request.query);
            if (!parsed.success) {
                return reply.status(400).send({
                    error: { code: "VALIDATION_ERROR", message: parsed.error.message },
                });
            }
            const q = parsed.data;
            const result = await traverse({
                fromEntryId: q.from,
                direction: q.direction ?? "both",
                maxDepth: q.depth ?? 2,
                edgeTypes: q.edgeType ? q.edgeType.split(",") : undefined,
                minWeight: q.minWeight ?? 0,
                limit: q.limit ?? 50,
                includeData: q.populate ?? false,
            });
            return reply.send({
                data: { nodes: result.nodes, edges: result.edges, rootEntryId: result.rootEntryId, meta: { totalNodes: result.totalNodes, maxDepth: result.maxDepth, latencyMs: result.latencyMs } },
            });
        }
    );

    // GET /api/graph/neighbors
    app.get(
        "/api/graph/neighbors",
        { preHandler: requireAuth() },
        async (request, reply) => {
            const parsed = z.object({ id: z.string(), edgeType: z.string().optional(), direction: z.enum(["outbound", "inbound", "both"]).optional(), populate: z.enum(["true", "false"]).transform(v => v === "true").optional() }).safeParse(request.query);
            if (!parsed.success) return reply.status(400).send({ error: parsed.error.message });
            
            const q = parsed.data;
            const result = await traverse({
                fromEntryId: q.id,
                direction: q.direction ?? "both",
                maxDepth: 1,
                edgeTypes: q.edgeType ? q.edgeType.split(",") : undefined,
                includeData: q.populate ?? false,
            });
            return reply.send({ data: { nodes: result.nodes, edges: result.edges } });
        }
    );

    // GET /api/graph/path
    app.get(
        "/api/graph/path",
        { preHandler: requireAuth() },
        async (request, reply) => {
            const parsed = pathQuery.safeParse(request.query);
            if (!parsed.success) return reply.status(400).send({ error: parsed.error.message });
            const q = parsed.data;
            const result = await findShortestPath(q.from, q.to, { edgeTypes: q.edgeType ? q.edgeType.split(",") : undefined, maxDepth: q.maxDepth });
            return reply.send({ data: result });
        }
    );

    // GET /api/graph/recommend
    app.get(
        "/api/graph/recommend",
        { preHandler: requireAuth() },
        async (request, reply) => {
            const parsed = recommendQuery.safeParse(request.query);
            if (!parsed.success) return reply.status(400).send({ error: parsed.error.message });
            const q = parsed.data;
            const start = performance.now();
            const recommendations = await getRecommendations({ entryId: q.id, contentType: q.contentType, limit: q.limit, user: request.user! });
            return reply.send({ data: { recommendations, meta: { sourceEntryId: q.id, latencyMs: performance.now() - start } } });
        }
    );

    // POST /api/graph/query
    app.post(
        "/api/graph/query",
        { preHandler: requireAuth() },
        async (request, reply) => {
            const parsed = queryBody.safeParse(request.body);
            if (!parsed.success) return reply.status(400).send({ error: parsed.error.message });
            const start = performance.now();
            try {
                const nodes = await executeCypher(parsed.data.query);
                return reply.send({ data: nodes, meta: { query: parsed.data.query, latencyMs: performance.now() - start } });
            } catch (err: unknown) {
                return reply.status(400).send({ error: { code: "CYPHER_PARSE_ERROR", message: err instanceof Error ? err.message : String(err) } });
            }
        }
    );

    // GET /api/graph/visualize
    app.get(
        "/api/graph/visualize",
        { preHandler: requireAuth() },
        async (request, reply) => {
            const parsed = visualizeQuery.safeParse(request.query);
            if (!parsed.success) return reply.status(400).send({ error: parsed.error.message });
            const q = parsed.data;
            const result = await traverse({ fromEntryId: q.rootId, direction: "both", maxDepth: q.depth ?? 3, edgeTypes: q.edgeType ? q.edgeType.split(",") : undefined, includeData: true });
            
            const nodes = result.nodes.map(n => ({ data: { id: n.entryId, label: (n.data?.title as string) || n.entryId, contentType: n.contentType, data: n.data, group: n.contentType } }));
            const edges = result.edges.map(e => ({ data: { id: e.id, source: e.fromEntryId, target: e.toEntryId, edgeType: e.edgeType, weight: e.weight, label: e.edgeType } }));
            
            return reply.send({ data: { nodes, edges, meta: { rootId: q.rootId, nodeCount: nodes.length, edgeCount: edges.length } } });
        }
    );
}
