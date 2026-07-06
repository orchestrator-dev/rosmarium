import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { pluginRegistry } from "../plugins/plugin-registry.js";
import type { McpToolDefinition } from "@orchestrator.dev/types";

/**
 * Register all MCP tools from loaded plugins.
 * Call this after plugin loading is complete or during MCP server initialization.
 */
export function registerPluginMcpTools(server: McpServer): void {
    const plugins = pluginRegistry.getAll();

    for (const plugin of plugins) {
        if (!plugin.mcpTools || plugin.mcpTools.length === 0) {
            continue;
        }

        for (const tool of plugin.mcpTools) {
            const toolName = `plugin_${plugin.name}_${tool.name}`;
            console.error(`[MCP Plugin Bridge] Registering tool: ${toolName}`);

            server.tool(
                toolName,
                `[Plugin: ${plugin.name}] ${tool.description}`,
                tool.inputSchema as unknown as Parameters<McpServer["tool"]>[2],
                async (params: unknown) => {
                    try {
                        return await tool.handler(params as Record<string, unknown>);
                    } catch (error: unknown) {
                        const message =
                            error instanceof Error ? error.message : String(error);
                        return {
                            content: [
                                {
                                    type: "text" as const,
                                    text: JSON.stringify({
                                        error: true,
                                        plugin: plugin.name,
                                        tool: tool.name,
                                        message,
                                    }),
                                },
                            ],
                            isError: true,
                        };
                    }
                }
            );
        }
    }
}
