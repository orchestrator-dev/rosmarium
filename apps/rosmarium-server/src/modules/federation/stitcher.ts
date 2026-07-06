import { stitchSchemas } from "@graphql-tools/stitch";
import { RenameTypes, RenameRootFields } from "@graphql-tools/wrap";
import { buildHTTPExecutor } from "@graphql-tools/executor-http";
import { schemaFromExecutor } from "@graphql-tools/wrap";
import type { GraphQLSchema } from "graphql";
import { sourceService } from "./source.service.js";

export const stitcherService = {
    async stitch(localSchema: GraphQLSchema): Promise<GraphQLSchema> {
        const sources = await sourceService.listSources();
        const activeSources = sources.filter((s) => s.status === "active" && s.type === "graphql");

        const subschemas = [];

        for (const source of activeSources) {
            try {
                // Configure HTTP executor for the remote source
                const executor = buildHTTPExecutor({
                    endpoint: source.endpoint,
                    fetch: async (url, init) => {
                        // Simple caching layer
                        const { federationCacheService } = await import("./cache.service.js");
                        const method = init?.method || "GET";
                        const bodyHash = init?.body ? Buffer.from(init.body as string).toString("base64") : "";
                        const cacheKey = `${method}:${url}:${bodyHash}`;

                        const cached = await federationCacheService.getCachedResult(source.id, cacheKey);
                        if (cached) {
                            return new Response(JSON.stringify(cached), { headers: { "Content-Type": "application/json" } });
                        }

                        const res = await fetch(url, init);
                        const data = await res.json();
                        
                        // Cache for configured TTL
                        const ttl = (source.cacheConfig as { ttl?: number })?.ttl || 300;
                        await federationCacheService.setCachedResult(source.id, cacheKey, data, ttl as number);

                        return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
                    },
                    headers: (executorRequest) => {
                        const headers: Record<string, string> = {};
                        if (source.authConfig && typeof source.authConfig === "object") {
                            const auth = source.authConfig as any;
                            if (auth.type === "bearer" && auth.token) {
                                headers["Authorization"] = `Bearer ${auth.token}`;
                            } else if (auth.type === "apiKey" && auth.header && auth.key) {
                                headers[auth.header] = auth.key;
                            }
                        }
                        return headers;
                    },
                });

                // Introspect the remote schema
                const remoteSchema = await schemaFromExecutor(executor);

                // Add to subschemas with transforms to avoid collisions
                subschemas.push({
                    schema: remoteSchema,
                    executor,
                    transforms: [
                        new RenameTypes((name) => `${source.name}_${name}`),
                        new RenameRootFields((operation, name) => `${source.name}_${name}`),
                    ],
                });
            } catch (err) {
                console.error(`Failed to stitch source ${source.name}:`, err);
            }
        }

        if (subschemas.length === 0) {
            return localSchema;
        }

        // Stitch local + remote
        return stitchSchemas({
            subschemas: [
                { schema: localSchema },
                ...subschemas,
            ],
        });
    },
};
