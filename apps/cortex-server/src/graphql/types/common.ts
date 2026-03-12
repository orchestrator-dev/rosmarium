import { builder } from "../builder.js";

export const StatusEnum = builder.enumType("Status", {
    values: ["draft", "published", "archived"] as const,
});

export const SortDirectionEnum = builder.enumType("SortDirection", {
    values: ["asc", "desc"] as const,
});

export const SortInput = builder.inputType("SortInput", {
    fields: (t) => ({
        field: t.string({ required: true }),
        direction: t.field({ type: SortDirectionEnum, required: true }),
    }),
});
