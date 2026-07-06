import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { searchService } from "../../modules/search/search.service.js";
import { graphService } from "../../modules/graph/graph.service.js";
import type { AuthenticatedUser } from "../../modules/auth/auth.service.js";

const systemUser: AuthenticatedUser = {
    id: "mcp-system",
    email: "mcp@rosmarium.local",
    firstName: "MCP",
    lastName: "Agent",
    role: "super_admin",
    isActive: true,
};

export const registerSearchTools = (server: McpServer) => {
    // ── search_hybrid ────────────────────────────────────────────────────
    server.tool(
        "search_hybrid",
        "Perform a hybrid BM25 fulltext and vector similarity search across content entries. Supports filtering by content type, locale, and status, and tuning the weight (alpha) between fulltext (0.0) and vector (1.0) search.",
        {
            query: z.string().describe("The search query string"),
            contentType: z
                .string()
                .optional()
                .describe("Filter results by content type name"),
            locale: z
                .string()
                .optional()
                .describe("Filter results by locale code (e.g. 'en', 'de')"),
            status: z
                .string()
                .optional()
                .default("published")
                .describe("Filter results by status (default 'published')"),
            alpha: z
                .number()
                .min(0)
                .max(1)
                .optional()
                .default(0.5)
                .describe(
                    "Weight between fulltext (0.0) and vector (1.0) search. Default 0.5 is equal weight."
                ),
            limit: z
                .number()
                .optional()
                .default(10)
                .describe("Maximum number of results to return (default 10)"),
            cursor: z
                .string()
                .optional()
                .describe("Pagination cursor from a previous search"),
        },
        async ({ query, contentType, locale, status, alpha, limit, cursor }) => {
            try {
                const response = await searchService.search({
                    query,
                    contentType,
                    locale,
                    status,
                    alpha,
                    limit,
                    cursor,
                    user: systemUser,
                });
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: JSON.stringify(response, null, 2),
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

    // ── search_graph ─────────────────────────────────────────────────────
    server.tool(
        "search_graph",
        "Retrieve graph relationships (edges) connected to a specific content entry. Can traverse outgoing edges, incoming edges, or both directions.",
        {
            entryId: z.string().describe("The entry ID (cuid2) to inspect graph connections for"),
            direction: z
                .enum(["outbound", "inbound", "both"])
                .optional()
                .default("both")
                .describe("Direction of edges to retrieve (default 'both')"),
        },
        async ({ entryId, direction }) => {
            try {
                const edges = await graphService.getEdgesForEntry({
                    entryId,
                    direction: direction as "outbound" | "inbound" | "both" | undefined,
                });
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: JSON.stringify({ entryId, direction, edges }, null, 2),
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
