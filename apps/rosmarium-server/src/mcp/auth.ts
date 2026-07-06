import { config } from "../config.js";
import { db } from "../db/index.js";

export interface McpContext {
    userId: string;
    tenantId: string;
    apiKey: string;
}

/**
 * MCP authentication service.
 * Validates API keys and provides context for MCP operations.
 */
export const mcpAuth = {
    /**
     * Validate an MCP API key.
     * Checks against MCP_API_KEY environment variable.
     */
    validateApiKey(apiKey: string): boolean {
        const expectedKey = process.env.MCP_API_KEY;
        if (!expectedKey) {
            console.error('[MCP Auth] WARNING: MCP_API_KEY not set. All requests will be rejected.');
            return false;
        }
        return apiKey === expectedKey;
    },

    /**
     * Create a default MCP context for stdio connections.
     * In stdio mode, auth is handled by the host application.
     */
    getDefaultContext(): McpContext {
        return {
            userId: process.env.MCP_USER_ID || 'mcp-agent',
            tenantId: process.env.MCP_TENANT_ID || 'default',
            apiKey: process.env.MCP_API_KEY || '',
        };
    },
};
