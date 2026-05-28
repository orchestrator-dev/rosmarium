import { and, eq, isNull } from "drizzle-orm";
import { db } from "../../db/index.js";
import { contentTypes } from "../../db/schema/index.js";
import {
    fieldSchema,
    fieldsArraySchema,
    validateFieldValue,
    type FieldDefinition,
} from "./field-types.js";

export interface ParsedContentType {
    id: string;
    name: string;
    displayName: string;
    description: string | null;
    fields: FieldDefinition[];
    settings: Record<string, unknown>;
    isSystem: boolean;
    archivedAt: Date | null;
    createdBy: string | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface CreateContentTypeInput {
    name: string;
    displayName: string;
    description?: string;
    fields: FieldDefinition[];
    settings?: Record<string, unknown>;
    createdBy?: string;
}

export interface UpdateContentTypeInput {
    displayName?: string;
    description?: string;
    fields?: FieldDefinition[];
    settings?: Record<string, unknown>;
}

export interface FieldError {
    field: string;
    message: string;
}

export interface ValidationResult {
    valid: boolean;
    errors: FieldError[];
}

function parseRow(row: typeof contentTypes.$inferSelect): ParsedContentType {
    const fields = fieldsArraySchema.parse(row.fields);
    const settings =
        row.settings && typeof row.settings === "object" && !Array.isArray(row.settings)
            ? (row.settings as Record<string, unknown>)
            : {};
    return {
        id: row.id,
        name: row.name,
        displayName: row.displayName,
        description: row.description,
        fields,
        settings,
        isSystem: row.isSystem,
        archivedAt: row.archivedAt,
        createdBy: row.createdBy,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}

export class ContentTypeRegistry {
    private cache: Map<string, ParsedContentType> = new Map();

    /** Load all active content types from DB into the in-memory cache. */
    async load(): Promise<void> {
        const rows = await db
            .select()
            .from(contentTypes)
            .where(isNull(contentTypes.archivedAt));

        this.cache.clear();
        for (const row of rows) {
            try {
                const parsed = parseRow(row);
                this.cache.set(parsed.name, parsed);
            } catch {
                // Skip rows with invalid field definitions (shouldn't happen in normal flow)
            }
        }
    }

    /** Register a new content type. Throws if name already exists. */
    async register(input: CreateContentTypeInput): Promise<ParsedContentType> {
        if (this.cache.has(input.name)) {
            throw new Error(`Content type '${input.name}' already exists`);
        }

        // Validate field definitions
        const fieldNames = new Set<string>();
        for (const field of input.fields) {
            const parsed = fieldSchema.safeParse(field);
            if (!parsed.success) {
                throw new Error(
                    `Invalid field definition: ${parsed.error.message}`,
                );
            }
            if (fieldNames.has(field.name)) {
                throw new Error(`Duplicate field name: '${field.name}'`);
            }
            fieldNames.add(field.name);
        }

        const [row] = await db
            .insert(contentTypes)
            .values({
                name: input.name,
                displayName: input.displayName,
                description: input.description,
                fields: input.fields,
                settings: input.settings ?? {},
                createdBy: input.createdBy,
            })
            .returning();

        if (!row) throw new Error("Failed to insert content type");

        const parsed = parseRow(row);
        this.cache.set(parsed.name, parsed);
        return parsed;
    }

    /** Update an existing content type by ID. */
    async update(
        id: string,
        patch: UpdateContentTypeInput,
    ): Promise<ParsedContentType> {
        if (patch.fields) {
            const fieldNames = new Set<string>();
            for (const field of patch.fields) {
                const result = fieldSchema.safeParse(field);
                if (!result.success) {
                    throw new Error(`Invalid field definition: ${result.error.message}`);
                }
                if (fieldNames.has(field.name)) {
                    throw new Error(`Duplicate field name: '${field.name}'`);
                }
                fieldNames.add(field.name);
            }
        }

        const updateData: Partial<typeof contentTypes.$inferInsert> = {
            updatedAt: new Date(),
        };
        if (patch.displayName !== undefined) updateData.displayName = patch.displayName;
        if (patch.description !== undefined) updateData.description = patch.description;
        if (patch.fields !== undefined) updateData.fields = patch.fields;
        if (patch.settings !== undefined) updateData.settings = patch.settings;

        const [row] = await db
            .update(contentTypes)
            .set(updateData)
            .where(and(eq(contentTypes.id, id), isNull(contentTypes.archivedAt)))
            .returning();

        if (!row) throw new Error(`Content type '${id}' not found`);

        const parsed = parseRow(row);
        // Update cache by name
        for (const [name, ct] of this.cache.entries()) {
            if (ct.id === id) {
                this.cache.delete(name);
                break;
            }
        }
        this.cache.set(parsed.name, parsed);
        return parsed;
    }

    /** Soft-delete a content type by ID (set archivedAt). */
    async delete(id: string): Promise<void> {
        const [row] = await db
            .update(contentTypes)
            .set({ archivedAt: new Date(), updatedAt: new Date() })
            .where(and(eq(contentTypes.id, id), isNull(contentTypes.archivedAt)))
            .returning();

        if (!row) throw new Error(`Content type '${id}' not found`);

        // Remove from cache
        for (const [name, ct] of this.cache.entries()) {
            if (ct.id === id) {
                this.cache.delete(name);
                break;
            }
        }
    }

    /** Synchronous cache lookup by name. */
    get(name: string): ParsedContentType | undefined {
        return this.cache.get(name);
    }

    /** Return all registered (active) content types. */
    getAll(): ParsedContentType[] {
        return Array.from(this.cache.values());
    }

    /** Validate entry data against a content type's field definitions. */
    validateEntry(
        contentTypeName: string,
        data: unknown,
    ): ValidationResult {
        const contentType = this.cache.get(contentTypeName);
        if (!contentType) {
            return {
                valid: false,
                errors: [{ field: "_", message: `Unknown content type: '${contentTypeName}'` }],
            };
        }

        if (typeof data !== "object" || data === null || Array.isArray(data)) {
            return {
                valid: false,
                errors: [{ field: "_", message: "Data must be a plain object" }],
            };
        }

        const dataRecord = data as Record<string, unknown>;
        const errors: FieldError[] = [];

        for (const field of contentType.fields) {
            const value = dataRecord[field.name];
            const error = validateFieldValue(field, value);
            if (error) {
                errors.push({ field: field.name, message: error });
            }
        }

        return { valid: errors.length === 0, errors };
    }
}

/** Singleton registry — imported by routes and services. */
export const registry = new ContentTypeRegistry();
