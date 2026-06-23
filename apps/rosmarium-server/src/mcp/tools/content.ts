import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { crudService } from "../../modules/content/crud.service.js";

export const registerContentTools = (server: McpServer) => {
    server.tool(
        "content_list",
        "List content entries with filtering",
        {
            contentType: z.string().describe("The content type slug"),
            limit: z.number().optional().default(10),
            offset: z.number().optional().default(0),
        },
        async ({ contentType, limit, offset }) => {
            const result = await crudService.findMany(contentType, { limit, offset });
            return {
                content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
            };
        }
    );

    server.tool(
        "content_get",
        "Get a content entry by ID",
        {
            contentType: z.string(),
            id: z.string(),
        },
        async ({ contentType, id }) => {
            const entry = await crudService.findOne(contentType, id);
            return {
                content: [{ type: "text", text: JSON.stringify(entry, null, 2) }],
            };
        }
    );

    server.tool(
        "content_create",
        "Create a new content entry",
        {
            contentType: z.string(),
            data: z.record(z.unknown()),
        },
        async ({ contentType, data }) => {
            // Passing a dummy userId and tenantId for now, these should be from MCP context/auth
            const entry = await crudService.create(contentType, data, { userId: "system", tenantId: "system" });
            return {
                content: [{ type: "text", text: JSON.stringify(entry, null, 2) }],
            };
        }
    );
};
