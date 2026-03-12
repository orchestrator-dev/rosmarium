import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { contentCrudService } from "../../modules/content/crud.service.js";
import { registry } from "../../modules/content/registry.js";
import type { ParsedFilters, SortInput } from "../../modules/content/query.builder.js";

interface ListQuery {
    filters?: Record<string, Record<string, string>>;
    sort?: string; // "field:direction,field2:direction2"
    limit?: string;
    cursor?: string;
    locale?: string;
    status?: string;
}

function parseSortParam(sort: string | undefined): SortInput {
    if (!sort) return [];
    return sort.split(",").map((part) => {
        const [field, rawDir] = part.split(":");
        const direction = rawDir === "desc" ? "desc" : "asc";
        return { field: field ?? "createdAt", direction };
    });
}

const contentEntryRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
    // GET /api/content/:type — list entries
    app.get<{
        Params: { type: string };
        Querystring: ListQuery;
    }>(
        "/api/content/:type",
        {
            schema: {
                tags: ["Content Entries"],
                summary: "List content entries for a given type",
                params: {
                    type: "object",
                    properties: { type: { type: "string" } },
                    required: ["type"],
                },
                querystring: {
                    type: "object",
                    properties: {
                        limit: { type: "string" },
                        cursor: { type: "string" },
                        locale: { type: "string" },
                        status: { type: "string", enum: ["draft", "published", "archived"] },
                        sort: { type: "string" },
                    },
                    additionalProperties: true,
                },
                response: {
                    200: {
                        type: "object",
                        properties: {
                            data: { type: "array" },
                            meta: {
                                type: "object",
                                properties: {
                                    pagination: {
                                        type: "object",
                                        properties: {
                                            total: { type: "integer" },
                                            limit: { type: "integer" },
                                            nextCursor: { type: ["string", "null"] },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        async (request, reply) => {
            if (!registry.get(request.params.type)) {
                return reply.status(404).send({
                    error: {
                        code: "NOT_FOUND",
                        message: `Content type '${request.params.type}' not found`,
                    },
                });
            }
            try {
                const limit = Math.min(parseInt(request.query.limit ?? "20", 10) || 20, 100);
                const result = await contentCrudService.findMany({
                    contentTypeName: request.params.type,
                    filters: request.query.filters as ParsedFilters | undefined,
                    sort: parseSortParam(request.query.sort),
                    pagination: { limit, cursor: request.query.cursor },
                    locale: request.query.locale,
                    status: request.query.status as "draft" | "published" | "archived" | undefined,
                });
                return {
                    data: result.entries,
                    meta: {
                        pagination: {
                            total: result.total,
                            limit,
                            nextCursor: result.nextCursor,
                        },
                    },
                };
            } catch (err) {
                const message = err instanceof Error ? err.message : "Unknown error";
                return reply.status(400).send({ error: { code: "BAD_REQUEST", message } });
            }
        },
    );

    // POST /api/content/:type — create entry
    app.post<{
        Params: { type: string };
        Body: { data: Record<string, unknown>; locale?: string; createdBy?: string };
    }>(
        "/api/content/:type",
        {
            schema: {
                tags: ["Content Entries"],
                summary: "Create a content entry",
                params: {
                    type: "object",
                    properties: { type: { type: "string" } },
                    required: ["type"],
                },
                body: {
                    type: "object",
                    required: ["data"],
                    properties: {
                        data: { type: "object" },
                        locale: { type: "string" },
                        createdBy: { type: "string" },
                    },
                },
                response: {
                    201: { type: "object", properties: { data: { type: "object" } } },
                },
            },
        },
        async (request, reply) => {
            if (!registry.get(request.params.type)) {
                return reply.status(404).send({
                    error: { code: "NOT_FOUND", message: `Content type '${request.params.type}' not found` },
                });
            }
            try {
                const entry = await contentCrudService.create({
                    contentTypeName: request.params.type,
                    data: request.body.data,
                    locale: request.body.locale,
                    createdBy: request.body.createdBy ?? "anonymous",
                });
                return reply.status(201).send({ data: entry });
            } catch (err) {
                const message = err instanceof Error ? err.message : "Unknown error";
                return reply.status(422).send({ error: { code: "VALIDATION_ERROR", message } });
            }
        },
    );

    // GET /api/content/:type/:id — get single entry
    app.get<{
        Params: { type: string; id: string };
        Querystring: { locale?: string };
    }>(
        "/api/content/:type/:id",
        {
            schema: {
                tags: ["Content Entries"],
                summary: "Get a single content entry",
                params: {
                    type: "object",
                    properties: { type: { type: "string" }, id: { type: "string" } },
                    required: ["type", "id"],
                },
                response: {
                    200: { type: "object", properties: { data: { type: "object" } } },
                },
            },
        },
        async (request, reply) => {
            if (!registry.get(request.params.type)) {
                return reply.status(404).send({
                    error: { code: "NOT_FOUND", message: `Content type '${request.params.type}' not found` },
                });
            }
            const entry = await contentCrudService.findOne({
                contentTypeName: request.params.type,
                id: request.params.id,
                locale: request.query.locale,
            });
            if (!entry) {
                return reply.status(404).send({
                    error: { code: "NOT_FOUND", message: `Entry '${request.params.id}' not found` },
                });
            }
            return { data: entry };
        },
    );

    // PATCH /api/content/:type/:id — update entry
    app.patch<{
        Params: { type: string; id: string };
        Body: { data: Partial<Record<string, unknown>>; updatedBy?: string };
    }>(
        "/api/content/:type/:id",
        {
            schema: {
                tags: ["Content Entries"],
                summary: "Update a content entry (merges data)",
                params: {
                    type: "object",
                    properties: { type: { type: "string" }, id: { type: "string" } },
                    required: ["type", "id"],
                },
                body: {
                    type: "object",
                    required: ["data"],
                    properties: {
                        data: { type: "object" },
                        updatedBy: { type: "string" },
                    },
                },
                response: {
                    200: { type: "object", properties: { data: { type: "object" } } },
                },
            },
        },
        async (request, reply) => {
            try {
                const entry = await contentCrudService.update({
                    id: request.params.id,
                    contentTypeName: request.params.type,
                    data: request.body.data,
                    updatedBy: request.body.updatedBy ?? "anonymous",
                });
                return { data: entry };
            } catch (err) {
                const message = err instanceof Error ? err.message : "Unknown error";
                const status = message.includes("not found") ? 404 : 422;
                return reply.status(status).send({
                    error: { code: status === 404 ? "NOT_FOUND" : "VALIDATION_ERROR", message },
                });
            }
        },
    );

    // DELETE /api/content/:type/:id — hard delete
    app.delete<{
        Params: { type: string; id: string };
        Body: { deletedBy?: string };
    }>(
        "/api/content/:type/:id",
        {
            schema: {
                tags: ["Content Entries"],
                summary: "Delete a content entry",
                params: {
                    type: "object",
                    properties: { type: { type: "string" }, id: { type: "string" } },
                    required: ["type", "id"],
                },
                response: { 204: { type: "null" } },
            },
        },
        async (request, reply) => {
            try {
                await contentCrudService.delete(
                    request.params.id,
                    request.params.type,
                    request.body?.deletedBy ?? "anonymous",
                );
                return reply.status(204).send();
            } catch (err) {
                const message = err instanceof Error ? err.message : "Unknown error";
                const status = message.includes("not found") ? 404 : 500;
                return reply.status(status).send({
                    error: { code: status === 404 ? "NOT_FOUND" : "INTERNAL_SERVER_ERROR", message },
                });
            }
        },
    );

    // POST /api/content/:type/:id/publish
    app.post<{
        Params: { type: string; id: string };
        Body: { updatedBy?: string };
    }>(
        "/api/content/:type/:id/publish",
        {
            schema: {
                tags: ["Content Entries"],
                summary: "Publish a content entry",
                params: {
                    type: "object",
                    properties: { type: { type: "string" }, id: { type: "string" } },
                    required: ["type", "id"],
                },
                response: { 200: { type: "object", properties: { data: { type: "object" } } } },
            },
        },
        async (request, reply) => {
            try {
                const entry = await contentCrudService.publish(
                    request.params.id,
                    request.body?.updatedBy ?? "anonymous",
                );
                return { data: entry };
            } catch (err) {
                const message = err instanceof Error ? err.message : "Unknown error";
                const status = message.includes("not found") ? 404 : 500;
                return reply.status(status).send({
                    error: { code: status === 404 ? "NOT_FOUND" : "INTERNAL_SERVER_ERROR", message },
                });
            }
        },
    );

    // POST /api/content/:type/:id/unpublish
    app.post<{
        Params: { type: string; id: string };
        Body: { updatedBy?: string };
    }>(
        "/api/content/:type/:id/unpublish",
        {
            schema: {
                tags: ["Content Entries"],
                summary: "Unpublish a content entry",
                params: {
                    type: "object",
                    properties: { type: { type: "string" }, id: { type: "string" } },
                    required: ["type", "id"],
                },
                response: { 200: { type: "object", properties: { data: { type: "object" } } } },
            },
        },
        async (request, reply) => {
            try {
                const entry = await contentCrudService.unpublish(
                    request.params.id,
                    request.body?.updatedBy ?? "anonymous",
                );
                return { data: entry };
            } catch (err) {
                const message = err instanceof Error ? err.message : "Unknown error";
                const status = message.includes("not found") ? 404 : 500;
                return reply.status(status).send({
                    error: { code: status === 404 ? "NOT_FOUND" : "INTERNAL_SERVER_ERROR", message },
                });
            }
        },
    );

    // GET /api/content/:type/:id/versions
    app.get<{ Params: { type: string; id: string } }>(
        "/api/content/:type/:id/versions",
        {
            schema: {
                tags: ["Content Entries"],
                summary: "List versions of a content entry",
                params: {
                    type: "object",
                    properties: { type: { type: "string" }, id: { type: "string" } },
                    required: ["type", "id"],
                },
                response: {
                    200: { type: "object", properties: { data: { type: "array" } } },
                },
            },
        },
        async (request) => {
            const versions = await contentCrudService.getVersions(request.params.id);
            return { data: versions };
        },
    );

    // POST /api/content/:type/:id/versions/:versionId/restore
    app.post<{
        Params: { type: string; id: string; versionId: string };
        Body: { restoredBy?: string };
    }>(
        "/api/content/:type/:id/versions/:versionId/restore",
        {
            schema: {
                tags: ["Content Entries"],
                summary: "Restore a content entry to a previous version",
                params: {
                    type: "object",
                    properties: {
                        type: { type: "string" },
                        id: { type: "string" },
                        versionId: { type: "string" },
                    },
                    required: ["type", "id", "versionId"],
                },
                response: { 200: { type: "object", properties: { data: { type: "object" } } } },
            },
        },
        async (request, reply) => {
            try {
                const entry = await contentCrudService.restoreVersion(
                    request.params.id,
                    request.params.versionId,
                    request.body?.restoredBy ?? "anonymous",
                );
                return { data: entry };
            } catch (err) {
                const message = err instanceof Error ? err.message : "Unknown error";
                const status = message.includes("not found") ? 404 : 500;
                return reply.status(status).send({
                    error: { code: status === 404 ? "NOT_FOUND" : "INTERNAL_SERVER_ERROR", message },
                });
            }
        },
    );
};

export default fp(contentEntryRoutes, { name: "content-entry-routes" });
