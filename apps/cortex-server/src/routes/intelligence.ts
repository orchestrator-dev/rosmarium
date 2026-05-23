/**
 * Intelligence routes — on-demand AI analysis of content entries.
 *
 * POST /api/content/:type/:id/tag        — generate tags for an entry
 * POST /api/content/:type/:id/summarize  — summarize entry content
 * GET  /api/content/:type/:id/entities   — get or extract named entities
 * GET  /api/content/:type/duplicates     — scan for duplicate entries
 */

import type { FastifyInstance } from "fastify";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { contentCrudService } from "../modules/content/crud.service.js";
import { registry } from "../modules/content/registry.js";
import { intelligenceService } from "../modules/intelligence/intelligence.service.js";
import { PERMISSIONS } from "../modules/rbac/permissions.js";
import { rbacService } from "../modules/rbac/rbac.service.js";
import { db } from "../db/index.js";
import type { AuthenticatedUser } from "../modules/auth/auth.service.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Extract text from all string fields of an entry. */
function extractTextFields(
    data: Record<string, unknown>,
    fields: { name: string; type: string }[]
): string {
    return fields
        .filter((f) => f.type === "text" || f.type === "richtext" || f.type === "textarea")
        .map((f) => (typeof data[f.name] === "string" ? (data[f.name] as string) : ""))
        .filter(Boolean)
        .join("\n\n");
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const tagBodySchema = z.object({
    threshold: z.number().min(0).max(1).optional(),
});

const summarizeBodySchema = z.object({
    maxWords: z.number().int().min(20).max(1000).optional(),
    style: z.enum(["brief", "detailed", "bullet"]).optional(),
});

// ─── Routes ───────────────────────────────────────────────────────────────────

export default async function intelligenceRoutes(app: FastifyInstance) {
    // ── POST /api/content/:type/:id/tag ───────────────────────────────────────
    app.post<{ Params: { type: string; id: string } }>(
        "/api/content/:type/:id/tag",
        async (request, reply) => {
            const user = request.user as AuthenticatedUser | undefined;
            if (!user || !rbacService.can(user, PERMISSIONS.CONTENT_UPDATE_ANY)) {
                return reply.status(403).send({ error: "Forbidden" });
            }

            const ct = registry.get(request.params.type);
            if (!ct) return reply.status(404).send({ error: "Unknown content type" });

            const entry = await contentCrudService.findOne({
                contentTypeName: request.params.type,
                id: request.params.id,
            });
            if (!entry) return reply.status(404).send({ error: "Entry not found" });

            const body = tagBodySchema.safeParse(request.body ?? {});
            const threshold = body.success ? body.data.threshold : undefined;

            const aiSettings = ct.settings["aiIntelligence"] as
                | { tagTaxonomy?: string[] }
                | undefined;
            const labels = aiSettings?.tagTaxonomy ?? [];

            if (labels.length === 0) {
                return reply.send({ tags: [], message: "No tag taxonomy configured" });
            }

            const text = extractTextFields(
                entry.data as Record<string, unknown>,
                ct.fields
            );

            const result = await intelligenceService.tagEntry({
                entryId: entry.id,
                text,
                labels,
                save: true,
                threshold,
            });

            return reply.send({ tags: result.tags, latencyMs: result.latencyMs });
        }
    );

    // ── POST /api/content/:type/:id/summarize ─────────────────────────────────
    app.post<{ Params: { type: string; id: string }; Querystring: { save?: string } }>(
        "/api/content/:type/:id/summarize",
        async (request, reply) => {
            const user = request.user as AuthenticatedUser | undefined;
            if (!user || !rbacService.can(user, PERMISSIONS.CONTENT_READ_ANY)) {
                return reply.status(403).send({ error: "Forbidden" });
            }

            const ct = registry.get(request.params.type);
            if (!ct) return reply.status(404).send({ error: "Unknown content type" });

            const entry = await contentCrudService.findOne({
                contentTypeName: request.params.type,
                id: request.params.id,
            });
            if (!entry) return reply.status(404).send({ error: "Entry not found" });

            const body = summarizeBodySchema.safeParse(request.body ?? {});
            const save = request.query.save === "true";

            const text = extractTextFields(
                entry.data as Record<string, unknown>,
                ct.fields
            );

            const result = await intelligenceService.summarize({
                entryId: entry.id,
                text,
                save,
                maxWords: body.success ? body.data.maxWords : undefined,
                style: body.success ? body.data.style : undefined,
            });

            return reply.send(result);
        }
    );

    // ── GET /api/content/:type/:id/entities ───────────────────────────────────
    app.get<{ Params: { type: string; id: string } }>(
        "/api/content/:type/:id/entities",
        async (request, reply) => {
            const user = request.user as AuthenticatedUser | undefined;
            if (!user || !rbacService.can(user, PERMISSIONS.CONTENT_READ_ANY)) {
                return reply.status(403).send({ error: "Forbidden" });
            }

            const ct = registry.get(request.params.type);
            if (!ct) return reply.status(404).send({ error: "Unknown content type" });

            const entry = await contentCrudService.findOne({
                contentTypeName: request.params.type,
                id: request.params.id,
            });
            if (!entry) return reply.status(404).send({ error: "Entry not found" });

            // Return cached entities if available — fetch raw metadata
            const [metaRow] = await db.execute(
                sql`SELECT metadata FROM content_entries WHERE id = ${entry.id}`
            ) as { metadata: Record<string, unknown> | null }[];

            const aiMeta = (metaRow?.metadata as Record<string, unknown> | null)?.["ai"] as Record<string, unknown> | undefined;

            if (aiMeta?.["entities"]) {
                return reply.send({ entities: aiMeta["entities"], cached: true });
            }

            // Otherwise extract and persist
            const text = extractTextFields(
                entry.data as Record<string, unknown>,
                ct.fields
            );
            const result = await intelligenceService.extractEntities({
                entryId: entry.id,
                text,
            });

            return reply.send({ entities: result.entities, cached: false });
        }
    );

    // ── GET /api/content/:type/duplicates ─────────────────────────────────────
    app.get<{ Params: { type: string } }>(
        "/api/content/:type/duplicates",
        async (request, reply) => {
            const user = request.user as AuthenticatedUser | undefined;
            if (!user || !rbacService.can(user, PERMISSIONS.CONTENT_READ_ANY)) {
                return reply.status(403).send({ error: "Forbidden" });
            }

            if (!registry.get(request.params.type)) {
                return reply.status(404).send({ error: "Unknown content type" });
            }

            const result = await intelligenceService.scanDuplicates(request.params.type);
            return reply.send(result);
        }
    );
}
