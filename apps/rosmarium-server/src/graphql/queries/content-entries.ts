import { builder } from "../builder.js";
import { contentCrudService } from "../../modules/content/crud.service.js";
import { encodeCursor } from "../../modules/content/query.builder.js";
import type { ParsedFilters } from "../../modules/content/query.builder.js";
import { SortInput as SortInputType } from "../types/common.js";

builder.queryField("entries", (t) =>
    t.field({
        type: "EntryConnection",
        description: "Paginated list of content entries for a given type",
        args: {
            contentType: t.arg.string({ required: true }),
            filters: t.arg({ type: "JSON" }),
            sort: t.arg({ type: [SortInputType] }),
            first: t.arg.int({ defaultValue: 20 }),
            after: t.arg.string(),
            locale: t.arg.string(),
            status: t.arg.string(),
        },
        resolve: async (_, args) => {
            const limit = Math.min(args.first ?? 20, 100);
            const result = await contentCrudService.findMany({
                contentTypeName: args.contentType,
                filters: args.filters as ParsedFilters | undefined,
                sort: args.sort as import("../../modules/content/query.builder.js").SortInput ?? undefined,
                pagination: { limit, cursor: args.after ?? undefined },
                locale: args.locale ?? undefined,
                status: args.status as "draft" | "published" | "archived" | undefined,
            });

            return {
                edges: result.entries.map((entry) => ({
                    node: entry,
                    cursor: encodeCursor(entry.id),
                })),
                pageInfo: {
                    hasNextPage: result.nextCursor !== null,
                    endCursor: result.nextCursor,
                },
                totalCount: result.total,
            };
        },
    }),
);

builder.queryField("entry", (t) =>
    t.field({
        type: "ContentEntry",
        nullable: true,
        description: "Get a single content entry by id",
        args: {
            contentType: t.arg.string({ required: true }),
            id: t.arg.id({ required: true }),
        },
        resolve: (_, { contentType, id }) =>
            contentCrudService.findOne({ contentTypeName: contentType, id: String(id) }),
    }),
);
