// Simple auth for MCP stdio connections
export const mcpAuth = {
    validateApiKey: (apiKey: string) => {
        // Here we would validate against the database or env var
        return apiKey === process.env.MCP_API_KEY;
    }
};
