import { GraphQLError } from "graphql";
import { builder } from "../builder.js";
import { registry } from "../../modules/content/registry.js";
import type { FieldDefinition } from "../../modules/content/field-types.js";

builder.mutationField("registerContentType", (t) =>
    t.fieldWithInput({
        type: "ContentType",
        description: "Register a new content type (admin only)",
        input: {
            name: t.input.string({ required: true }),
            displayName: t.input.string({ required: true }),
            description: t.input.string(),
            fields: t.input.field({ type: "JSON", required: true }),
            settings: t.input.field({ type: "JSON" }),
        },
        resolve: async (_, { input }, ctx) => {
            if (!ctx.user) throw new GraphQLError("Unauthorized", { extensions: { code: "UNAUTHORIZED" } });
            if (!["admin", "super_admin"].includes(ctx.user.role)) {
                throw new GraphQLError("Forbidden — admin role required", { extensions: { code: "FORBIDDEN" } });
            }
            return registry.register({
                name: input.name,
                displayName: input.displayName,
                description: input.description ?? undefined,
                fields: (input.fields as FieldDefinition[]) ?? [],
                settings: (input.settings as Record<string, unknown>) ?? {},
                createdBy: ctx.user.id,
            });
        },
    }),
);

builder.mutationField("updateContentType", (t) =>
    t.fieldWithInput({
        type: "ContentType",
        description: "Update a content type's fields (admin only)",
        input: {
            name: t.input.string({ required: true }),
            displayName: t.input.string(),
            description: t.input.string(),
            fields: t.input.field({ type: "JSON" }),
            settings: t.input.field({ type: "JSON" }),
        },
        resolve: async (_, { input }, ctx) => {
            if (!ctx.user) throw new GraphQLError("Unauthorized", { extensions: { code: "UNAUTHORIZED" } });
            if (!["admin", "super_admin"].includes(ctx.user.role)) {
                throw new GraphQLError("Forbidden — admin role required", { extensions: { code: "FORBIDDEN" } });
            }
            const ct = registry.get(input.name);
            if (!ct) throw new GraphQLError(`Content type '${input.name}' not found`, { extensions: { code: "NOT_FOUND" } });
            return registry.update(ct.id, {
                displayName: input.displayName ?? undefined,
                description: input.description ?? undefined,
                fields: input.fields ? (input.fields as FieldDefinition[]) : undefined,
                settings: input.settings ? (input.settings as Record<string, unknown>) : undefined,
            });
        },
    }),
);
