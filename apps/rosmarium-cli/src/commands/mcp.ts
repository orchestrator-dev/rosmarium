import { startMcpServer } from "../../../apps/rosmarium-server/src/mcp/server.js";

export const mcpCommand = async () => {
    console.error("Starting MCP server via CLI...");
    await startMcpServer();
};
