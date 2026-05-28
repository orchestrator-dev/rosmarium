import { GraphQLError } from "graphql";
import { builder } from "../builder.js";
import { contentCrudService } from "../../modules/content/crud.service.js";

function requireAuth(user: { id: string; role: string } | null): asserts user is { id: string; role: string } {
    if (!user) throw new GraphQLError("Unauthorized", { extensions: { code: "UNAUTHORIZED" } });
}

function requireRole(user: { role: string }, ...roles: string[]): void {
    if (!roles.includes(user.role)) {
        throw new GraphQLError(`Forbidden — requires one of: ${roles.join(", ")}`, { extensions: { code: "FORBIDDEN" } });
    }
}

builder.mutationField("createEntry", (t) =>
    t.fieldWithInput({
        type: "ContentEntry",
        description: "Create a new content entry",
        input: {
            contentType: t.input.string({ required: true }),
            data: t.input.field({ type: "JSON", required: true }),
            locale: t.input.string(),
        },
        resolve: async (_, { input }, ctx) => {
            requireAuth(ctx.user);
            return contentCrudService.create({
                contentTypeName: input.contentType,
                data: input.data as Record<string, unknown>,
                locale: input.locale ?? undefined,
                createdBy: ctx.user.id,
            });
        },
    }),
);

builder.mutationField("updateEntry", (t) =>
    t.fieldWithInput({
        type: "ContentEntry",
        description: "Update a content entry (merges data)",
        input: {
            id: t.input.id({ required: true }),
            contentType: t.input.string({ required: true }),
            data: t.input.field({ type: "JSON", required: true }),
        },
        resolve: async (_, { input }, ctx) => {
            requireAuth(ctx.user);
            return contentCrudService.update({
                id: String(input.id),
                contentTypeName: input.contentType,
                data: input.data as Record<string, unknown>,
                updatedBy: ctx.user.id,
            });
        },
    }),
);

builder.mutationField("deleteEntry", (t) =>
    t.field({
        type: "Boolean",
        description: "Hard-delete a content entry",
        args: {
            contentType: t.arg.string({ required: true }),
            id: t.arg.id({ required: true }),
        },
        resolve: async (_, { contentType, id }, ctx) => {
            requireAuth(ctx.user);
            requireRole(ctx.user, "editor", "admin", "super_admin");
            await contentCrudService.delete(String(id), contentType, ctx.user.id);
            return true;
        },
    }),
);

builder.mutationField("publishEntry", (t) =>
    t.field({
        type: "ContentEntry",
        description: "Set entry status to published",
        args: {
            contentType: t.arg.string({ required: true }),
            id: t.arg.id({ required: true }),
        },
        resolve: async (_, { id }, ctx) => {
            requireAuth(ctx.user);
            return contentCrudService.publish(String(id), ctx.user.id);
        },
    }),
);

builder.mutationField("unpublishEntry", (t) =>
    t.field({
        type: "ContentEntry",
        description: "Set entry status back to draft",
        args: {
            contentType: t.arg.string({ required: true }),
            id: t.arg.id({ required: true }),
        },
        resolve: async (_, { id }, ctx) => {
            requireAuth(ctx.user);
            return contentCrudService.unpublish(String(id), ctx.user.id);
        },
    }),
);
