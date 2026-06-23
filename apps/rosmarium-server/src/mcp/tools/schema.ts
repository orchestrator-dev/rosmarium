import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { db } from "../../db/client.js";

export const registerSchemaTools = (server: McpServer) => {
    server.tool(
        "schema_list",
        "List all content type schemas",
        {},
        async () => {
            const types = await db.query.contentTypes.findMany();
            return {
                content: [{ type: "text", text: JSON.stringify(types, null, 2) }],
            };
        }
    );

    server.tool(
        "schema_get",
        "Get a content type schema definition",
        {
            slug: z.string(),
        },
        async ({ slug }) => {
            const type = await db.query.contentTypes.findFirst({
                where: (ct, { eq }) => eq(ct.slug, slug),
            });
            if (!type) {
                throw new Error(`Content type ${slug} not found`);
            }
            return {
                content: [{ type: "text", text: JSON.stringify(type, null, 2) }],
            };
        }
    );
};
