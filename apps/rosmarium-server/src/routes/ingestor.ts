/**
 * Ingestor routes — REST API for web crawl content ingestion jobs.
 *
 * POST   /api/ingestor/jobs                    — Start a new ingestion job
 * GET    /api/ingestor/jobs                    — List all ingestion jobs
 * GET    /api/ingestor/jobs/:jobId             — Get a single job's status
 * GET    /api/ingestor/jobs/:jobId/stream      — SSE live progress stream
 * DELETE /api/ingestor/jobs/:jobId             — Cancel + rollback a job
 * POST   /api/ingestor/jobs/:jobId/publish-all — Publish all draft entries
 * GET    /api/ingestor/jobs/:jobId/items       — List items in a job
 * DELETE /api/ingestor/jobs/:jobId/items/:id   — Remove a single item
 */

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import Redis from "ioredis";
import { ingestorService } from "../modules/ingestor/ingestor.service.js";
import { PERMISSIONS } from "../modules/rbac/permissions.js";
import { rbacService } from "../modules/rbac/rbac.service.js";
import { requireAuth } from "../modules/rbac/rbac.middleware.js";
import { config } from "../config.js";
import type { AuthenticatedUser } from "../modules/auth/auth.service.js";

// ─── Validation ───────────────────────────────────────────────────────────────

const webSourceSchema = z.object({
    type: z.literal("web"),
    startUrl: z.string().url("Must be a valid URL"),
    maxDepth: z.number().int().min(1).max(5).default(2),
    includePatterns: z.array(z.string()).default([]),
    excludePatterns: z.array(z.string()).default([]),
    respectRobotsTxt: z.boolean().default(true),
});

const fileSourceSchema = z.object({
    type: z.literal("file"),
    path: z.string().min(1),
    format: z.enum(["json", "xml", "text"]),
});

const dbSourceSchema = z.object({
    type: z.literal("database"),
    provider: z.enum(["postgres", "mongo"]),
    connectionString: z.string().min(1),
    queryOrCollection: z.string().min(1),
});

const cloudSourceSchema = z.object({
    type: z.literal("cloud"),
    provider: z.literal("s3"),
    bucket: z.string().min(1),
    prefix: z.string().optional(),
    endpoint: z.string().optional(),
});

const createJobSchema = z.object({
    source: z.discriminatedUnion("type", [
        webSourceSchema,
        fileSourceSchema,
        dbSourceSchema,
        cloudSourceSchema,
    ]),
    maxPages: z.number().int().min(1).max(5000).default(100),
    targetContentType: z.string().nullable().optional(),
    importAs: z.enum(["draft", "published"]).default("draft"),
    tenantId: z.string().nullable().optional(),
    contentSetName: z.string().min(1, "Content set name is required"),
    apiKey: z.string().min(1, "API key is required"),
    apiBaseUrl: z.string().url().default("http://localhost:3000"),
    duplicateThreshold: z.number().min(0).max(1).default(0.92),
    classificationModel: z.string().optional(),
    systemPrompt: z.string().nullable().optional(),
    userPrompt: z.string().nullable().optional(),
});

// ─── Routes ───────────────────────────────────────────────────────────────────

export default async function ingestorRoutes(app: FastifyInstance) {
    // ── POST /api/ingestor/jobs ────────────────────────────────────────────────
    app.post<{ Body: unknown }>(
        "/api/ingestor/jobs",
        { onRequest: requireAuth() },
        async (request, reply) => {
            const user = request.user as AuthenticatedUser | undefined;
            if (!user || !rbacService.can(user, PERMISSIONS.CONTENT_CREATE)) {
                return reply.status(403).send({ error: "Forbidden" });
            }

            const parsed = createJobSchema.safeParse(request.body);
            if (!parsed.success) {
                return reply.status(400).send({
                    error: "Validation failed",
                    details: parsed.error.flatten().fieldErrors,
                });
            }

            const { jobId, contentSetId } = await ingestorService.createJob({
                config: parsed.data,
                userId: user.id,
            });

            return reply.status(201).send({
                data: { jobId, contentSetId, status: "queued" },
            });
        }
    );

    // ── GET /api/ingestor/jobs ─────────────────────────────────────────────────
    app.get<{ Querystring: { limit?: string; offset?: string } }>(
        "/api/ingestor/jobs",
        { onRequest: requireAuth() },
        async (request, reply) => {
            const limit = Math.min(Number(request.query.limit ?? 20), 100);
            const offset = Number(request.query.offset ?? 0);

            const result = await ingestorService.listJobs({ limit, offset });
            return reply.send(result);
        }
    );

    // ── GET /api/ingestor/jobs/:jobId ──────────────────────────────────────────
    app.get<{ Params: { jobId: string } }>(
        "/api/ingestor/jobs/:jobId",
        { onRequest: requireAuth() },
        async (request, reply) => {
            const job = await ingestorService.getJob(request.params.jobId);
            if (!job) return reply.status(404).send({ error: "Job not found" });
            return reply.send({ data: job });
        }
    );

    // ── GET /api/ingestor/jobs/:jobId/stream — SSE live progress ──────────────
    app.get<{ Params: { jobId: string } }>(
        "/api/ingestor/jobs/:jobId/stream",
        { onRequest: requireAuth() },
        async (request, reply) => {
            const { jobId } = request.params;

            reply.raw.setHeader("Content-Type", "text/event-stream");
            reply.raw.setHeader("Cache-Control", "no-cache");
            reply.raw.setHeader("Connection", "keep-alive");
            reply.raw.setHeader("X-Accel-Buffering", "no");
            reply.raw.flushHeaders();

            const redis = new Redis(config.REDIS_URL);
            const subscriber = new Redis(config.REDIS_URL);

            // Send current state immediately on connect
            const currentState = await redis.get(`ingestor:status:${jobId}`);
            if (currentState) {
                reply.raw.write(`event: progress\ndata: ${currentState}\n\n`);
            }

            // Subscribe to live updates
            await subscriber.subscribe(`ingestor:progress:${jobId}`);
            subscriber.on("message", (_channel: string, message: string) => {
                try {
                    const data = JSON.parse(message) as Record<string, unknown>;
                    const eventType = data["status"] === "complete" || data["status"] === "failed"
                        ? "complete"
                        : "progress";
                    reply.raw.write(`event: ${eventType}\ndata: ${message}\n\n`);

                    if (eventType === "complete") {
                        cleanup();
                    }
                } catch {
                    reply.raw.write(`event: error\ndata: ${JSON.stringify({ message: "Parse error" })}\n\n`);
                }
            });

            // Heartbeat to keep connection alive
            const heartbeat = setInterval(() => {
                reply.raw.write(": heartbeat\n\n");
            }, 15000);

            const cleanup = () => {
                clearInterval(heartbeat);
                subscriber.quit().catch(() => void 0);
                redis.quit().catch(() => void 0);
                reply.raw.end();
            };

            request.raw.on("close", cleanup);
            request.raw.on("error", cleanup);
        }
    );

    // ── DELETE /api/ingestor/jobs/:jobId — Cancel + rollback ──────────────────
    app.delete<{ Params: { jobId: string } }>(
        "/api/ingestor/jobs/:jobId",
        { onRequest: requireAuth() },
        async (request, reply) => {
            const user = request.user as AuthenticatedUser | undefined;
            if (!user || !rbacService.can(user, PERMISSIONS.CONTENT_DELETE_ANY)) {
                return reply.status(403).send({ error: "Forbidden" });
            }

            await ingestorService.cancelJob(request.params.jobId);
            const deleted = await ingestorService.rollbackJob(request.params.jobId);

            return reply.status(200).send({ deleted });
        }
    );

    // ── POST /api/ingestor/jobs/:jobId/publish-all ────────────────────────────
    app.post<{ Params: { jobId: string } }>(
        "/api/ingestor/jobs/:jobId/publish-all",
        { onRequest: requireAuth() },
        async (request, reply) => {
            const user = request.user as AuthenticatedUser | undefined;
            if (!user || !rbacService.can(user, PERMISSIONS.CONTENT_PUBLISH)) {
                return reply.status(403).send({ error: "Forbidden" });
            }

            const published = await ingestorService.publishAll(
                request.params.jobId,
                user.id
            );

            return reply.send({ published });
        }
    );

    // ── GET /api/ingestor/jobs/:jobId/items ───────────────────────────────────
    app.get<{
        Params: { jobId: string };
        Querystring: {
            limit?: string;
            offset?: string;
            status?: "imported" | "skipped" | "failed";
            contentType?: string;
        };
    }>(
        "/api/ingestor/jobs/:jobId/items",
        { onRequest: requireAuth() },
        async (request, reply) => {
            const limit = Math.min(Number(request.query.limit ?? 50), 200);
            const offset = Number(request.query.offset ?? 0);

            const result = await ingestorService.getItems(request.params.jobId, {
                limit,
                offset,
                status: request.query.status,
                contentType: request.query.contentType,
            });

            return reply.send(result);
        }
    );

    // ── DELETE /api/ingestor/jobs/:jobId/items/:itemId ────────────────────────
    app.delete<{ Params: { jobId: string; itemId: string } }>(
        "/api/ingestor/jobs/:jobId/items/:itemId",
        { onRequest: requireAuth() },
        async (request, reply) => {
            const user = request.user as AuthenticatedUser | undefined;
            if (!user || !rbacService.can(user, PERMISSIONS.CONTENT_DELETE_ANY)) {
                return reply.status(403).send({ error: "Forbidden" });
            }

            await ingestorService.deleteItem(request.params.itemId);
            return reply.status(204).send();
        }
    );
}
