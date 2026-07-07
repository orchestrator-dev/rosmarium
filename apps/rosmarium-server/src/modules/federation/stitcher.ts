import { stitchSchemas } from "@graphql-tools/stitch";
import { RenameTypes, RenameRootFields } from "@graphql-tools/wrap";
import { remoteExecutorService } from "./remote-executor.js";
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
                // Configure HTTP executor for the remote source using enterprise remoteExecutorService
                const executor = remoteExecutorService.buildExecutor(source);

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
