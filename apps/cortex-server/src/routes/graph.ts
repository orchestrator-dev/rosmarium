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
}
