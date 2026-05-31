import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { Type } from "@sinclair/typebox";
import { schemaSyncService } from "./schema-sync.service.js";
import { requireRole } from "../rbac/rbac.middleware.js";

const schemaFile = Type.Object({
    filename: Type.String(),
    content: Type.String(),
});

export const schemaSyncRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
    // Both diff and sync endpoints require super_admin privileges
    fastify.addHook("preHandler", requireRole("super_admin"));

    fastify.get("/schema/export", async (_request, reply) => {
        try {
            const files = schemaSyncService.exportAll();
            return reply.send({ data: files });
        } catch (err) {
            fastify.log.error({ err }, "schema export failed");
            return reply.status(500).send({ error: { code: "INTERNAL_ERROR" } });
        }
    });

    fastify.post(
        "/schema/diff",
        {
            schema: {
                body: Type.Object({
                    files: Type.Array(schemaFile),
                }),
            },
        },
        async (request, reply) => {
            try {
                const body = request.body as { files: any[] };
                const diff = schemaSyncService.getDiff(body.files);
                return reply.send({ data: diff });
            } catch (err) {
                fastify.log.error({ err }, "schema diff failed");
                return reply.status(400).send({ error: { code: "BAD_REQUEST", message: String(err) } });
            }
        }
    );

    fastify.post(
        "/schema/sync",
        {
            schema: {
                body: Type.Object({
                    files: Type.Array(schemaFile),
                }),
            },
        },
        async (request, reply) => {
            try {
                const body = request.body as { files: any[] };
                const diff = schemaSyncService.getDiff(body.files);
                await schemaSyncService.applyDiff(diff);
                return reply.send({ data: { success: true, applied: diff } });
            } catch (err) {
                fastify.log.error({ err }, "schema sync failed");
                return reply.status(400).send({ error: { code: "BAD_REQUEST", message: String(err) } });
            }
        }
    );
};
