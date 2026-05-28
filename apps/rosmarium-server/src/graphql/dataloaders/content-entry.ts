import DataLoader from "dataloader";
import { inArray } from "drizzle-orm";
import { db } from "../../db/index.js";
import { contentTypes, contentEntries } from "../../db/schema/index.js";
import type { ParsedContentType } from "../../modules/content/registry.js";
import { fieldsArraySchema } from "../../modules/content/field-types.js";
import type { ContentEntry } from "../../db/schema/index.js";

/** Per-request DataLoader: batch-loads ParsedContentType by DB id. */
export function createContentTypeLoader(): DataLoader<string, ParsedContentType | null> {
    return new DataLoader<string, ParsedContentType | null>(async (ids) => {
        const rows = await db
            .select()
            .from(contentTypes)
            .where(inArray(contentTypes.id, [...ids]));

        return ids.map((id) => {
            const row = rows.find((r) => r.id === id);
            if (!row) return null;
            const fields = fieldsArraySchema.safeParse(row.fields);
            const settings =
                row.settings && typeof row.settings === "object" && !Array.isArray(row.settings)
                    ? (row.settings as Record<string, unknown>)
                    : {};
            return {
                id: row.id,
                name: row.name,
                displayName: row.displayName,
                description: row.description,
                fields: fields.success ? fields.data : [],
                settings,
                isSystem: row.isSystem,
                archivedAt: row.archivedAt,
                createdBy: row.createdBy,
                createdAt: row.createdAt,
                updatedAt: row.updatedAt,
            };
        });
    });
}

/** Per-request DataLoader: batch-loads ContentEntry by id. */
export function createContentEntryLoader(): DataLoader<string, ContentEntry | null> {
    return new DataLoader<string, ContentEntry | null>(async (ids) => {
        const rows = await db
            .select()
            .from(contentEntries)
            .where(inArray(contentEntries.id, [...ids]));

        return ids.map((id) => rows.find((r) => r.id === id) ?? null);
    });
}
