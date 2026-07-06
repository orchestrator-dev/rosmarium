import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { contentCrudService } from "../../modules/content/crud.service.js";

export const registerContentTools = (server: McpServer) => {
    // ── content_list ────────────────────────────────────────────────────
    server.tool(
        "content_list",
        "List content entries for a given content type. Supports cursor-based pagination, locale filtering, status filtering, and arbitrary field filters. Returns an array of entries, a nextCursor for pagination, and the total count.",
        {
            contentType: z.string().describe("Content type slug, e.g. 'article' or 'page'"),
            limit: z
                .number()
                .optional()
                .default(20)
                .describe("Max entries to return per page (default 20)"),
            cursor: z
                .string()
                .optional()
                .describe("Opaque cursor returned from a previous content_list call for pagination"),
            locale: z
                .string()
                .optional()
                .describe("Locale code to filter by, e.g. 'en', 'de'"),
            status: z
                .enum(["draft", "published", "archived"])
                .optional()
                .describe("Filter entries by status"),
            filters: z
                .record(z.unknown())
                .optional()
                .describe(
                    "Arbitrary field filters as a JSON object. Keys are field names, values are filter values."
                ),
        },
        async ({ contentType, limit, cursor, locale, status, filters }) => {
            try {
                const result = await contentCrudService.findMany({
                    contentTypeName: contentType,
                    pagination: { limit, cursor },
                    locale,
                    status,
                    filters: filters as unknown as Parameters<typeof contentCrudService.findMany>[0]["filters"],
                });
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: JSON.stringify(
                                {
                                    entries: result.entries,
                                    nextCursor: result.nextCursor,
                                    total: result.total,
                                },
                                null,
                                2
                            ),
                        },
                    ],
                };
            } catch (err: unknown) {
                const message =
                    err instanceof Error ? err.message : "Unknown error";
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: JSON.stringify(
                                { error: message },
                                null,
                                2
                            ),
                        },
                    ],
                    isError: true,
                };
            }
        }
    );

    // ── content_get ─────────────────────────────────────────────────────
    server.tool(
        "content_get",
        "Retrieve a single content entry by its ID and content type. Optionally populate relation fields. Returns the full entry object or null if not found.",
        {
            contentType: z
                .string()
                .describe("Content type slug the entry belongs to"),
            id: z.string().describe("The entry ID (cuid2)"),
            locale: z
                .string()
                .optional()
                .describe("Locale code to scope the lookup"),
            populate: z
                .boolean()
                .optional()
                .default(true)
                .describe(
                    "Whether to resolve relation fields to full objects (default true)"
                ),
        },
        async ({ contentType, id, locale, populate }) => {
            try {
                const entry = await contentCrudService.findOne({
                    contentTypeName: contentType,
                    id,
                    locale,
                    populate,
                });
                if (!entry) {
                    return {
                        content: [
                            {
                                type: "text" as const,
                                text: JSON.stringify(
                                    {
                                        error: `Entry '${id}' not found in content type '${contentType}'`,
                                    },
                                    null,
                                    2
                                ),
                            },
                        ],
                        isError: true,
                    };
                }
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: JSON.stringify(entry, null, 2),
                        },
                    ],
                };
            } catch (err: unknown) {
                const message =
                    err instanceof Error ? err.message : "Unknown error";
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: JSON.stringify(
                                { error: message },
                                null,
                                2
                            ),
                        },
                    ],
                    isError: true,
                };
            }
        }
    );

    // ── content_create ──────────────────────────────────────────────────
    server.tool(
        "content_create",
        "Create a new content entry. The data object should contain the field values defined in the content type schema. Slug fields are auto-generated when possible. Returns the created entry.",
        {
            contentType: z
                .string()
                .describe("Content type slug to create an entry for"),
            data: z
                .record(z.unknown())
                .describe(
                    "Field values for the new entry, matching the content type schema"
                ),
            locale: z
                .string()
                .optional()
                .default("en")
                .describe("Locale for the entry (default 'en')"),
            createdBy: z
                .string()
                .optional()
                .default("mcp-agent")
                .describe(
                    "User identifier for the creator (default 'mcp-agent')"
                ),
        },
        async ({ contentType, data, locale, createdBy }) => {
            try {
                const entry = await contentCrudService.create({
                    contentTypeName: contentType,
                    data: data as Record<string, unknown>,
                    locale,
                    createdBy,
                });
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: JSON.stringify(entry, null, 2),
                        },
                    ],
                };
            } catch (err: unknown) {
                const message =
                    err instanceof Error ? err.message : "Unknown error";
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: JSON.stringify(
                                { error: message },
                                null,
                                2
                            ),
                        },
                    ],
                    isError: true,
                };
            }
        }
    );

    // ── content_update ──────────────────────────────────────────────────
    server.tool(
        "content_update",
        "Update an existing content entry with partial data. Only the fields provided in the data object will be overwritten; other fields remain unchanged. Returns the updated entry.",
        {
            id: z.string().describe("ID of the entry to update"),
            contentType: z
                .string()
                .describe("Content type slug the entry belongs to"),
            data: z
                .record(z.unknown())
                .describe(
                    "Partial field values to update — only include changed fields"
                ),
            updatedBy: z
                .string()
                .optional()
                .default("mcp-agent")
                .describe(
                    "User identifier for the updater (default 'mcp-agent')"
                ),
        },
        async ({ id, contentType, data, updatedBy }) => {
            try {
                const entry = await contentCrudService.update({
                    id,
                    contentTypeName: contentType,
                    data: data as Record<string, unknown>,
                    updatedBy,
                });
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: JSON.stringify(entry, null, 2),
                        },
                    ],
                };
            } catch (err: unknown) {
                const message =
                    err instanceof Error ? err.message : "Unknown error";
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: JSON.stringify(
                                { error: message },
                                null,
                                2
                            ),
                        },
                    ],
                    isError: true,
                };
            }
        }
    );

    // ── content_publish ─────────────────────────────────────────────────
    server.tool(
        "content_publish",
        "Publish a content entry, changing its status from draft to published and setting its publishedAt timestamp. Returns the published entry.",
        {
            id: z.string().describe("ID of the entry to publish"),
            publishedBy: z
                .string()
                .optional()
                .default("mcp-agent")
                .describe(
                    "User identifier for who is publishing (default 'mcp-agent')"
                ),
        },
        async ({ id, publishedBy }) => {
            try {
                const entry = await contentCrudService.publish(id, publishedBy);
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: JSON.stringify(entry, null, 2),
                        },
                    ],
                };
            } catch (err: unknown) {
                const message =
                    err instanceof Error ? err.message : "Unknown error";
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: JSON.stringify(
                                { error: message },
                                null,
                                2
                            ),
                        },
                    ],
                    isError: true,
                };
            }
        }
    );

    // ── content_unpublish ───────────────────────────────────────────────
    server.tool(
        "content_unpublish",
        "Unpublish a content entry, reverting its status to draft and clearing its publishedAt timestamp. Returns the unpublished entry.",
        {
            id: z.string().describe("ID of the entry to unpublish"),
            unpublishedBy: z
                .string()
                .optional()
                .default("mcp-agent")
                .describe(
                    "User identifier for who is unpublishing (default 'mcp-agent')"
                ),
        },
        async ({ id, unpublishedBy }) => {
            try {
                const entry = await contentCrudService.unpublish(
                    id,
                    unpublishedBy
                );
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: JSON.stringify(entry, null, 2),
                        },
                    ],
                };
            } catch (err: unknown) {
                const message =
                    err instanceof Error ? err.message : "Unknown error";
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: JSON.stringify(
                                { error: message },
                                null,
                                2
                            ),
                        },
                    ],
                    isError: true,
                };
            }
        }
    );

    // ── content_delete ──────────────────────────────────────────────────
    server.tool(
        "content_delete",
        "Permanently delete a content entry. This action cannot be undone. Returns a success confirmation with the deleted entry ID.",
        {
            id: z.string().describe("ID of the entry to delete"),
            contentType: z
                .string()
                .describe("Content type slug the entry belongs to"),
            deletedBy: z
                .string()
                .optional()
                .default("mcp-agent")
                .describe(
                    "User identifier for who is deleting (default 'mcp-agent')"
                ),
        },
        async ({ id, contentType, deletedBy }) => {
            try {
                await contentCrudService.delete(id, contentType, deletedBy);
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: JSON.stringify(
                                {
                                    success: true,
                                    deletedId: id,
                                    contentType,
                                },
                                null,
                                2
                            ),
                        },
                    ],
                };
            } catch (err: unknown) {
                const message =
                    err instanceof Error ? err.message : "Unknown error";
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: JSON.stringify(
                                { error: message },
                                null,
                                2
                            ),
                        },
                    ],
                    isError: true,
                };
            }
        }
    );
};
