import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { registry } from "../../modules/content/registry.js";
import type {
    CreateContentTypeInput,
    UpdateContentTypeInput,
} from "../../modules/content/registry.js";

const contentTypeRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
    // GET /api/content-types — list all registered content types
    app.get(
        "/api/content-types",
        {
            schema: {
                tags: ["Content Types"],
                summary: "List all registered content types",
                response: {
                    200: {
                        type: "object",
                        properties: {
                            data: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        id: { type: "string" },
                                        name: { type: "string" },
                                        displayName: { type: "string" },
                                        description: { type: ["string", "null"] },
                                        fields: { type: "array" },
                                        isSystem: { type: "boolean" },
                                        createdAt: { type: "string" },
                                        updatedAt: { type: "string" },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        async () => {
            return { data: registry.getAll() };
        },
    );

    // POST /api/content-types — register a new content type
    app.post<{
        Body: CreateContentTypeInput;
    }>(
        "/api/content-types",
        {
            schema: {
                tags: ["Content Types"],
                summary: "Register a new content type",
                body: {
                    type: "object",
                    required: ["name", "displayName", "fields"],
                    properties: {
                        name: { type: "string", pattern: "^[a-z][a-zA-Z0-9]*$" },
                        displayName: { type: "string", minLength: 1 },
                        description: { type: "string" },
                        fields: { type: "array" },
                        settings: { type: "object" },
                        createdBy: { type: "string" },
                    },
                },
                response: {
                    201: {
                        type: "object",
                        properties: { data: { type: "object" } },
                    },
                },
            },
        },
        async (request, reply) => {
            try {
                const contentType = await registry.register(request.body);
                return reply.status(201).send({ data: contentType });
            } catch (err) {
                const message = err instanceof Error ? err.message : "Unknown error";
                if (message.includes("already exists")) {
                    return reply.status(409).send({
                        error: { code: "CONFLICT", message },
                    });
                }
                return reply.status(422).send({
                    error: { code: "VALIDATION_ERROR", message },
                });
            }
        },
    );

    // GET /api/content-types/:name — get single content type
    app.get<{ Params: { name: string } }>(
        "/api/content-types/:name",
        {
            schema: {
                tags: ["Content Types"],
                summary: "Get a content type by name",
                params: {
                    type: "object",
                    properties: { name: { type: "string" } },
                    required: ["name"],
                },
                response: {
                    200: {
                        type: "object",
                        properties: { data: { type: "object" } },
                    },
                },
            },
        },
        async (request, reply) => {
            const contentType = registry.get(request.params.name);
            if (!contentType) {
                return reply.status(404).send({
                    error: {
                        code: "NOT_FOUND",
                        message: `Content type '${request.params.name}' not found`,
                    },
                });
            }
            return { data: contentType };
        },
    );

    // PATCH /api/content-types/:name — update content type fields
    app.patch<{
        Params: { name: string };
        Body: UpdateContentTypeInput;
    }>(
        "/api/content-types/:name",
        {
            schema: {
                tags: ["Content Types"],
                summary: "Update a content type",
                params: {
                    type: "object",
                    properties: { name: { type: "string" } },
                    required: ["name"],
                },
                body: {
                    type: "object",
                    properties: {
                        displayName: { type: "string" },
                        description: { type: "string" },
                        fields: { type: "array" },
                        settings: { type: "object" },
                    },
                },
                response: {
                    200: {
                        type: "object",
                        properties: { data: { type: "object" } },
                    },
                },
            },
        },
        async (request, reply) => {
            const existing = registry.get(request.params.name);
            if (!existing) {
                return reply.status(404).send({
                    error: {
                        code: "NOT_FOUND",
                        message: `Content type '${request.params.name}' not found`,
                    },
                });
            }
            try {
                const updated = await registry.update(existing.id, request.body);
                return { data: updated };
            } catch (err) {
                const message = err instanceof Error ? err.message : "Unknown error";
                return reply.status(422).send({
                    error: { code: "VALIDATION_ERROR", message },
                });
            }
        },
    );

    // DELETE /api/content-types/:name — archive content type
    app.delete<{ Params: { name: string } }>(
        "/api/content-types/:name",
        {
            schema: {
                tags: ["Content Types"],
                summary: "Archive a content type (soft delete)",
                params: {
                    type: "object",
                    properties: { name: { type: "string" } },
                    required: ["name"],
                },
                response: {
                    204: { type: "null" },
                },
            },
        },
        async (request, reply) => {
            const existing = registry.get(request.params.name);
            if (!existing) {
                return reply.status(404).send({
                    error: {
                        code: "NOT_FOUND",
                        message: `Content type '${request.params.name}' not found`,
                    },
                });
            }
            await registry.delete(existing.id);
            return reply.status(204).send();
        },
    );
};

export default fp(contentTypeRoutes, { name: "content-type-routes" });
