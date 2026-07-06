import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { i18nService } from "../../modules/i18n/i18n.service.js";
import { workflowService } from "../../modules/workflow/workflow.service.js";
import { registry } from "../../modules/content/registry.js";

export const registerResources = (server: McpServer) => {
    server.resource(
        "content-types",
        "rosmarium://content-types",
        { description: "All content type definitions with their field schemas" },
        async (uri) => {
            try {
                const allTypes = registry.getAll();
                const types = allTypes.map((ct) => ({
                    name: ct.name,
                    slug: ct.name,
                    fields: ct.fields,
                }));
                return {
                    contents: [{
                        uri: uri.href,
                        text: JSON.stringify(types, null, 2),
                    }],
                };
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                return {
                    contents: [{
                        uri: uri.href,
                        text: JSON.stringify({ error: message }),
                    }],
                };
            }
        }
    );

    server.resource(
        "locales",
        "rosmarium://locales",
        { description: "Available locales and their fallback chains" },
        async (uri) => {
            try {
                const allLocales = await i18nService.getLocales();
                const localesWithFallback = await Promise.all(
                    allLocales.map(async (locale) => ({
                        code: locale.code,
                        isDefault: locale.isDefault,
                        fallbackChain: await i18nService.getFallbackChain(locale.code),
                    }))
                );
                return {
                    contents: [{
                        uri: uri.href,
                        text: JSON.stringify(localesWithFallback, null, 2),
                    }],
                };
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                return {
                    contents: [{
                        uri: uri.href,
                        text: JSON.stringify({ error: message }),
                    }],
                };
            }
        }
    );

    server.resource(
        "workflows",
        "rosmarium://workflows",
        { description: "Workflow definitions with states and transitions" },
        async (uri) => {
            try {
                const allWorkflows = await workflowService.getWorkflows();
                const result = allWorkflows.map((wf) => ({
                    id: wf.id,
                    name: wf.name,
                    isDefault: wf.isDefault,
                    definition: wf.definition,
                }));
                return {
                    contents: [{
                        uri: uri.href,
                        text: JSON.stringify(result, null, 2),
                    }],
                };
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                return {
                    contents: [{
                        uri: uri.href,
                        text: JSON.stringify({ error: message }),
                    }],
                };
            }
        }
    );
};
