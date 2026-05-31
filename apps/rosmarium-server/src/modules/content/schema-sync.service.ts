/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, @typescript-eslint/ban-ts-comment */
import { registry, type ParsedContentType, type CreateContentTypeInput } from "./registry.js";
import { parseYamlToSchema, exportSchemaToYaml } from "./schema-serializer.js";
import { diffSchemas, type SchemaDiffResult } from "./schema-diff.js";

export interface SchemaFile {
    filename: string;
    content: string;
}

export const schemaSyncService = {
    /**
     * Compute the differences between the current database schema and a set of incoming YAML files.
     */
    getDiff(incomingFiles: SchemaFile[]): SchemaDiffResult {
        const incomingSchemas: CreateContentTypeInput[] = incomingFiles.map(file => {
            try {
                return parseYamlToSchema(file.content);
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                throw new Error(`Failed to parse schema file ${file.filename}: ${message}`);
            }
        });

        // Current active schemas
        const currentSchemas = registry.getAll();
        
        return diffSchemas(currentSchemas, incomingSchemas);
    },

    /**
     * Apply a computed diff to the database using the content type registry.
     */
    async applyDiff(diff: SchemaDiffResult): Promise<void> {
        // We do deletes first, then updates, then adds to avoid naming conflicts if someone
        // replaces a content type (though rename is currently just delete + add).
        
        for (const removed of diff.removed) {
            await registry.delete(removed.id);
        }

        for (const updated of diff.updated) {
            // The registry expects partial patches, but we can just pass the new full fields/settings
            await registry.update(updated.original.id, {
                displayName: updated.incoming.displayName,
                description: updated.incoming.description,
                isComponent: updated.incoming.isComponent,
                fields: updated.incoming.fields,
                settings: updated.incoming.settings,
            });
        }

        for (const added of diff.added) {
            await registry.register({
                name: added.name,
                displayName: added.displayName,
                description: added.description,
                isComponent: added.isComponent,
                fields: added.fields,
                settings: added.settings,
                createdBy: "system-sync",
            });
        }
    },

    /**
     * Export all current schemas as YAML files.
     */
    exportAll(): SchemaFile[] {
        const currentSchemas = registry.getAll();
        return currentSchemas
            .filter(schema => !schema.isSystem)
            .map(schema => {
                return {
                    filename: `${schema.name}.yml`,
                    content: exportSchemaToYaml(schema),
                };
            });
    }
};
