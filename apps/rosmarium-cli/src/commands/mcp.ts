/**
 * CLI command to start the Rosmarium MCP server.
 *
 * Uses dynamic import to load the MCP server module from the server package.
 * This avoids compile-time coupling between CLI and server packages.
 */
export const mcpCommand = async () => {
    console.error("Starting Rosmarium MCP server via CLI...");

    try {
        // @ts-expect-error - dynamic import at runtime without build dependency
        const { startMcpServer } = await import("@orchestrator.dev/server/mcp/server.js");
        await startMcpServer();
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[MCP] Failed to start MCP server: ${message}`);
        console.error("[MCP] Ensure the server package is built and accessible.");
        process.exit(1);
    }
};
