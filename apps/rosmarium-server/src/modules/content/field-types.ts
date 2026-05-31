import { z } from "zod";
import { blockDocumentSchema } from "@orchestrator.dev/types";

const baseField = z.object({
    name: z.string().regex(/^[a-z][a-zA-Z0-9]*$/, {
        message: "Field name must be camelCase (start with lowercase letter)",
    }),
    label: z.string().min(1),
    required: z.boolean().default(false),
    unique: z.boolean().default(false),
    localised: z.boolean().default(false),
    conditions: z.array(z.object({
        field: z.string(),
        operator: z.enum(['eq', 'neq', 'contains', 'gt', 'lt', 'exists', 'empty']),
        value: z.unknown().optional(),
        logic: z.enum(['and', 'or']).optional(),
    })).optional(),
});

// Use z.lazy for recursive field schemas (group contains sub-fields)
export const fieldSchema: z.ZodType<FieldDefinition, z.ZodTypeDef, unknown> = z.lazy(() =>
    z.discriminatedUnion("type", [
        baseField.extend({
            type: z.literal("text"),
            minLength: z.number().int().nonnegative().optional(),
            maxLength: z.number().int().positive().optional(),
        }),
        baseField.extend({ type: z.literal("richText") }),
        baseField.extend({
            type: z.literal("number"),
            min: z.number().optional(),
            max: z.number().optional(),
            integer: z.boolean().default(false),
        }),
        baseField.extend({ type: z.literal("boolean") }),
        baseField.extend({ type: z.literal("date") }),
        baseField.extend({ type: z.literal("datetime") }),
        baseField.extend({ type: z.literal("media") }),
        baseField.extend({
            type: z.literal("relation"),
            targetContentType: z.string(),
            many: z.boolean().default(false),
        }),
        baseField.extend({ type: z.literal("json") }),
        baseField.extend({
            type: z.literal("select"),
            options: z
                .array(z.object({ label: z.string(), value: z.string() }))
                .min(1),
        }),
        baseField.extend({
            type: z.literal("slug"),
            generatedFrom: z.string().optional(),
        }),
        // --- Nested / Composite field types ---
        baseField.extend({
            type: z.literal("group"),
            fields: z.lazy(() => fieldsArraySchema),
        }),
        baseField.extend({
            type: z.literal("component"),
            allowedComponents: z.array(z.string()).min(1),
        }),
        baseField.extend({
            type: z.literal("blocks"),
            allowedComponents: z.array(z.string()).min(1),
            minBlocks: z.number().int().nonnegative().optional(),
            maxBlocks: z.number().int().positive().optional(),
        }),
    ]),
);

/** Explicit type for field definitions including nested/composite types. */
export type FieldDefinition = z.infer<typeof baseField> &
    (
        | { type: "text"; minLength?: number; maxLength?: number }
        | { type: "richText" }
        | { type: "number"; min?: number; max?: number; integer: boolean }
        | { type: "boolean" }
        | { type: "date" }
        | { type: "datetime" }
        | { type: "media" }
        | {
              type: "relation";
              targetContentType: string;
              many: boolean;
          }
        | { type: "json" }
        | {
              type: "select";
              options: { label: string; value: string }[];
          }
        | { type: "slug"; generatedFrom?: string }
        | { type: "group"; fields: FieldDefinition[] }
        | { type: "component"; allowedComponents: string[] }
        | {
              type: "blocks";
              allowedComponents: string[];
              minBlocks?: number;
              maxBlocks?: number;
          }
    );

export const fieldsArraySchema: z.ZodType<FieldDefinition[], z.ZodTypeDef, unknown> = z.lazy(() =>
    z.array(fieldSchema),
);

/**
 * Lookup function type for resolving component content type field definitions.
 * Used during recursive validation of component and blocks fields.
 */
export type ComponentFieldsLookup = (
    componentName: string,
) => FieldDefinition[] | null;

/** Validate a single value against a field definition. Returns error message or null. */
export function validateFieldValue(
    field: FieldDefinition,
    value: unknown,
    lookupComponentFields?: ComponentFieldsLookup,
): string | null {
    if (value === undefined || value === null) {
        if (field.required) return `Field '${field.name}' is required`;
        return null;
    }

    switch (field.type) {
        case "text":
        case "slug": {
            if (typeof value !== "string")
                return `Field '${field.name}' must be a string`;
            if (field.type === "text") {
                if (
                    field.minLength !== undefined &&
                    value.length < field.minLength
                )
                    return `Field '${field.name}' must be at least ${field.minLength} characters`;
                if (
                    field.maxLength !== undefined &&
                    value.length > field.maxLength
                )
                    return `Field '${field.name}' must be at most ${field.maxLength} characters`;
            }
            return null;
        }
        case "richText": {
            if (typeof value === "string") return null;
            const result = blockDocumentSchema.safeParse(value);
            return result.success
                ? null
                : `Field '${field.name}' must be a string or a valid BlockDocument JSON`;
        }
        case "number": {
            if (typeof value !== "number")
                return `Field '${field.name}' must be a number`;
            if (field.integer && !Number.isInteger(value))
                return `Field '${field.name}' must be an integer`;
            if (field.min !== undefined && value < field.min)
                return `Field '${field.name}' must be >= ${field.min}`;
            if (field.max !== undefined && value > field.max)
                return `Field '${field.name}' must be <= ${field.max}`;
            return null;
        }
        case "boolean":
            return typeof value === "boolean"
                ? null
                : `Field '${field.name}' must be a boolean`;
        case "date":
        case "datetime":
            return typeof value === "string" || value instanceof Date
                ? null
                : `Field '${field.name}' must be a date string or Date object`;
        case "select": {
            const validValues = field.options.map((o) => o.value);
            return validValues.includes(String(value))
                ? null
                : `Field '${field.name}' must be one of: ${validValues.join(", ")}`;
        }
        case "media":
        case "json":
        case "relation":
            return null; // structural validation done elsewhere

        // --- Nested / Composite field validation ---
        case "group": {
            if (typeof value !== "object" || value === null || Array.isArray(value))
                return `Field '${field.name}' must be an object`;
            const groupData = value as Record<string, unknown>;
            for (const subField of field.fields) {
                const error = validateFieldValue(
                    subField,
                    groupData[subField.name],
                    lookupComponentFields,
                );
                if (error) return `${field.name}.${error}`;
            }
            return null;
        }
        case "component": {
            if (typeof value !== "object" || value === null || Array.isArray(value))
                return `Field '${field.name}' must be an object`;
            const compData = value as Record<string, unknown>;
            const compName = compData["_component"];
            if (typeof compName !== "string")
                return `Field '${field.name}' must have a '_component' string identifier`;
            if (!field.allowedComponents.includes(compName))
                return `Field '${field.name}': component '${compName}' is not allowed. Allowed: ${field.allowedComponents.join(", ")}`;
            // Validate component sub-fields if lookup is available
            if (lookupComponentFields) {
                const compFields = lookupComponentFields(compName);
                if (compFields) {
                    for (const subField of compFields) {
                        const error = validateFieldValue(
                            subField,
                            compData[subField.name],
                            lookupComponentFields,
                        );
                        if (error) return `${field.name}.${error}`;
                    }
                }
            }
            return null;
        }
        case "blocks": {
            if (!Array.isArray(value))
                return `Field '${field.name}' must be an array`;
            if (
                field.minBlocks !== undefined &&
                value.length < field.minBlocks
            )
                return `Field '${field.name}' must have at least ${field.minBlocks} blocks`;
            if (
                field.maxBlocks !== undefined &&
                value.length > field.maxBlocks
            )
                return `Field '${field.name}' must have at most ${field.maxBlocks} blocks`;
            for (let i = 0; i < value.length; i++) {
                const block = value[i];
                if (
                    typeof block !== "object" ||
                    block === null ||
                    Array.isArray(block)
                )
                    return `Field '${field.name}[${i}]' must be an object`;
                const blockData = block as Record<string, unknown>;
                const blockComp = blockData["_component"];
                if (typeof blockComp !== "string")
                    return `Field '${field.name}[${i}]' must have a '_component' string identifier`;
                if (!field.allowedComponents.includes(blockComp))
                    return `Field '${field.name}[${i}]': component '${blockComp}' is not allowed. Allowed: ${field.allowedComponents.join(", ")}`;
                // Validate block sub-fields if lookup is available
                if (lookupComponentFields) {
                    const compFields = lookupComponentFields(blockComp);
                    if (compFields) {
                        for (const subField of compFields) {
                            const error = validateFieldValue(
                                subField,
                                blockData[subField.name],
                                lookupComponentFields,
                            );
                            if (error)
                                return `${field.name}[${i}].${error}`;
                        }
                    }
                }
            }
            return null;
        }
        default:
            return null;
    }
}
