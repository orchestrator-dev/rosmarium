import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { z } from "zod";
import { apiKeyService } from "../../modules/auth/api-key.service.js";
import { requireAuth } from "../../modules/rbac/rbac.middleware.js";

// ─── Input schemas ─────────────────────────────────────────────────────────────

const createApiKeyBody = z.object({
    name: z.string().min(1).max(100),
    scopes: z.array(z.string()).min(1),
    expiresAt: z.string().datetime().optional(),
});

// ─── API key routes ────────────────────────────────────────────────────────────

const apiKeyRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
    // GET /api/auth/api-keys
    app.get(
        "/api/auth/api-keys",
        {
            preHandler: requireAuth(),
            schema: {
                tags: ["API Keys"],
                summary: "List your API keys (hash is never returned)",
                response: {
                    200: {
                        type: "object",
                        properties: {
                            data: { type: "array" },
                        },
                    },
                },
            },
        },
        async (request, reply) => {
            if (!request.user) {
                return reply.status(401).send({
                    error: { code: "UNAUTHORIZED", message: "Not authenticated" },
                });
            }
            const keys = await apiKeyService.list(request.user.id);
            return reply.status(200).send({ data: keys });
        }
    );

    // POST /api/auth/api-keys
    app.post(
        "/api/auth/api-keys",
        {
            preHandler: requireAuth(),
            schema: {
                tags: ["API Keys"],
                summary:
                    "Create a new API key. The rawKey field is shown ONCE and cannot be retrieved again.",
                body: {
                    type: "object",
                    required: ["name", "scopes"],
                    properties: {
                        name: { type: "string", minLength: 1, maxLength: 100 },
                        scopes: {
                            type: "array",
                            items: { type: "string" },
                            minItems: 1,
                        },
                        expiresAt: { type: "string", format: "date-time" },
                    },
                },
                response: {
                    201: {
                        type: "object",
                        properties: {
                            data: {
                                type: "object",
                                properties: {
                                    apiKey: { type: "object" },
                                    rawKey: {
                                        type: "string",
                                        description:
                                            "The full API key — shown ONCE, store it securely.",
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        async (request, reply) => {
            const body = createApiKeyBody.safeParse(request.body);
            if (!body.success) {
                return reply.status(400).send({
                    error: { code: "VALIDATION_ERROR", message: body.error.message },
                });
            }

            if (!request.user) {
                return reply.status(401).send({
                    error: { code: "UNAUTHORIZED", message: "Not authenticated" },
                });
            }

            try {
                const { apiKey, rawKey } = await apiKeyService.create({
                    name: body.data.name,
                    userId: request.user.id,
                    scopes: body.data.scopes,
                    expiresAt: body.data.expiresAt
                        ? new Date(body.data.expiresAt)
                        : undefined,
                });

                return reply.status(201).send({ data: { apiKey, rawKey } });
            } catch (err) {
                const message = err instanceof Error ? err.message : "Failed to create API key";
                return reply.status(422).send({
                    error: { code: "API_KEY_ERROR", message },
                });
            }
        }
    );

    // DELETE /api/auth/api-keys/:id
    app.delete<{ Params: { id: string } }>(
        "/api/auth/api-keys/:id",
        {
            preHandler: requireAuth(),
            schema: {
                tags: ["API Keys"],
                summary: "Revoke an API key",
                params: {
                    type: "object",
                    properties: { id: { type: "string" } },
                    required: ["id"],
                },
                response: { 204: { type: "null" } },
            },
        },
        async (request, reply) => {
            if (!request.user) {
                return reply.status(401).send({
                    error: { code: "UNAUTHORIZED", message: "Not authenticated" },
                });
            }

            await apiKeyService.revoke(request.params.id, request.user.id);
            return reply.status(204).send();
        }
    );
};

export default fp(apiKeyRoutes, { name: "api-key-routes" });
