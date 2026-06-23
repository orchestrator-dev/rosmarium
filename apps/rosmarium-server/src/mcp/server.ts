import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerContentTools } from "./tools/content.js";
import { registerSchemaTools } from "./tools/schema.js";
import { registerSearchTools } from "./tools/search.js";
import { registerAiTools } from "./tools/ai.js";
import { registerResources } from "./resources/index.js";

export const server = new McpServer({
    name: "rosmarium",
    version: "3.0.0",
});

// Register all tools and resources
registerContentTools(server);
registerSchemaTools(server);
registerSearchTools(server);
registerAiTools(server);
registerResources(server);

export const startMcpServer = async () => {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Rosmarium MCP server running on stdio");
};
