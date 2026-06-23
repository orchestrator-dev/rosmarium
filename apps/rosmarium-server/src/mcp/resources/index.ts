import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const registerResources = (server: McpServer) => {
    server.resource(
        "content-types",
        "rosmarium://content-types",
        { description: "All content type definitions" },
        async (uri) => {
            return {
                contents: [{
                    uri: uri.href,
                    text: JSON.stringify({ types: ["article", "author", "category"] }), // Placeholder
                }],
            };
        }
    );

    server.resource(
        "locales",
        "rosmarium://locales",
        { description: "Available locales and fallback chains" },
        async (uri) => {
            return {
                contents: [{
                    uri: uri.href,
                    text: JSON.stringify({ locales: ["en", "fr", "es"] }), // Placeholder
                }],
            };
        }
    );
};
