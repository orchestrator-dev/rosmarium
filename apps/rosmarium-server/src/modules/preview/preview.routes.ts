import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { previewService } from "./preview.service.js";
import { requireAuth } from "../rbac/rbac.middleware.js";
import { contentCrudService } from "../content/crud.service.js";
import { registry } from "../content/registry.js";

const tokenRequestSchema = z.object({
    entryId: z.string(),
    contentTypeId: z.string(),
});

export const previewRoutes: FastifyPluginAsync = async (app) => {
    // Generate a preview token (requires authentication)
    app.post(
        "/api/preview/token",
        { preHandler: [requireAuth] },
        async (req, reply) => {
            const body = tokenRequestSchema.parse(req.body);
            const token = await previewService.generateToken(
                body.entryId,
                body.contentTypeId,
            );
            return reply.send({ data: { token } });
        },
    );

    // Retrieve draft content using a preview token (public, protected by token)
    app.get<{ Params: { type: string; id: string }; Querystring: { token?: string } }>(
        "/api/preview/:type/:id",
        async (req, reply) => {
            const { type, id } = req.params;
            
            // Allow token from query string or Bearer token
            let token = req.query.token;
            if (!token && req.headers.authorization?.startsWith("Bearer ")) {
                token = req.headers.authorization.slice(7);
            }

            if (!token) {
                return reply.status(401).send({ error: { message: "Missing preview token" } });
            }

            try {
                const payload = await previewService.verifyToken(token);
                
                // Verify the token is scoped to this entry
                if (payload.entryId !== id) {
                    return reply.status(403).send({ error: { message: "Token is not valid for this entry" } });
                }

                // Verify the content type exists
                const contentType = registry.get(type);
                if (!contentType) {
                    return reply.status(404).send({ error: { message: "Content type not found" } });
                }

                // Ensure token content type matches the requested route's resolved content type
                if (payload.contentTypeId !== contentType.id) {
                    return reply.status(403).send({ error: { message: "Token is not valid for this content type" } });
                }

                // Use findOne which does NOT filter by `status: "published"`
                // Allowing the caller to fetch "draft" content securely.
                const entry = await contentCrudService.findOne({
                    contentTypeName: type,
                    id,
                });

                if (!entry) {
                    return reply.status(404).send({ error: { message: "Content not found" } });
                }

                return reply.send({ data: entry });
            } catch (err) {
                const msg = err instanceof Error ? err.message : "Invalid token";
                return reply.status(401).send({ error: { message: msg } });
            }
        },
    );
};
