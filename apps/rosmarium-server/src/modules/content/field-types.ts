import { z } from "zod";

const baseField = z.object({
    name: z.string().regex(/^[a-z][a-zA-Z0-9]*$/, {
        message: "Field name must be camelCase (start with lowercase letter)",
    }),
    label: z.string().min(1),
    required: z.boolean().default(false),
    unique: z.boolean().default(false),
    localised: z.boolean().default(false),
});

export const fieldSchema = z.discriminatedUnion("type", [
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
        options: z.array(z.object({ label: z.string(), value: z.string() })).min(1),
    }),
    baseField.extend({
        type: z.literal("slug"),
        generatedFrom: z.string().optional(),
    }),
]);

export type FieldDefinition = z.infer<typeof fieldSchema>;
export const fieldsArraySchema = z.array(fieldSchema);

/** Validate a single value against a field definition. Returns error message or null. */
export function validateFieldValue(
    field: FieldDefinition,
    value: unknown,
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
        case "richText":
            return typeof value === "string"
                ? null
                : `Field '${field.name}' must be a string`;
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
        default:
            return null;
    }
}
