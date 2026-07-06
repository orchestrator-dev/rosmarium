import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerContentTools } from "./tools/content.js";
import { registerSchemaTools } from "./tools/schema.js";
import { registerSearchTools } from "./tools/search.js";
import { registerAiTools } from "./tools/ai.js";
import { registerWorkflowTools } from "./tools/workflow.js";
import { registerResources } from "./resources/index.js";
import { registerPluginMcpTools } from "./plugin-bridge.js";
import { mcpAuth } from "./auth.js";

export const server = new McpServer({
    name: "rosmarium",
    version: "3.0.1",
});

// Register all tool groups
registerContentTools(server);
registerSchemaTools(server);
registerSearchTools(server);
registerAiTools(server);
registerWorkflowTools(server);
registerResources(server);
registerPluginMcpTools(server);

export const startMcpServer = async () => {
    // Validate environment
    const context = mcpAuth.getDefaultContext();
    console.error(`[MCP] Starting Rosmarium MCP server v3.0.1`);
    console.error(`[MCP] User: ${context.userId}, Tenant: ${context.tenantId}`);
    console.error(`[MCP] API key configured: ${context.apiKey ? 'yes' : 'no'}`);

    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("[MCP] Server running on stdio transport");
};
