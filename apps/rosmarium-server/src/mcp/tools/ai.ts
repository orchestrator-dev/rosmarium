import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export const registerAiTools = (server: McpServer) => {
    server.tool(
        "ai_summarize",
        "Summarize a content entry",
        {
            entryId: z.string(),
        },
        async ({ entryId }) => {
            // Integration with ai-worker
            return {
                content: [{ type: "text", text: JSON.stringify({ entryId, summary: "Generated summary." }) }],
            };
        }
    );

    server.tool(
        "ai_tag",
        "Auto-tag a content entry",
        {
            entryId: z.string(),
        },
        async ({ entryId }) => {
            return {
                content: [{ type: "text", text: JSON.stringify({ entryId, tags: ["AI", "Content"] }) }],
            };
        }
    );
};
