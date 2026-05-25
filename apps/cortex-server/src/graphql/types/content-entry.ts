import { builder } from "../builder.js";
import { StatusEnum } from "./common.js";

import { traverse } from "../../modules/graph/traversal/traversal.engine.js";

const TraversalNode = builder.objectRef<{ entryId: string; contentType: string; depth: number; data?: Record<string, unknown> }>("TraversalNode").implement({
    fields: (t) => ({
        entryId: t.exposeString("entryId"),
        contentType: t.exposeString("contentType"),
        depth: t.exposeInt("depth"),
        data: t.expose("data", { type: "JSON", nullable: true }),
    }),
});

builder.objectType("ContentEntry", {
    description: "A content entry instance",
    fields: (t) => ({
        id: t.exposeString("id"),
        contentTypeId: t.exposeString("contentTypeId"),
        contentType: t.field({
            type: "ContentType",
            nullable: true,
            resolve: (entry, _, ctx) => ctx.dataloaders.contentType.load(entry.contentTypeId),
        }),
        locale: t.exposeString("locale"),
        status: t.field({ type: StatusEnum, resolve: (e) => e.status as "draft" | "published" | "archived" }),
        data: t.expose("data", { type: "JSON" }),
        publishedAt: t.expose("publishedAt", { type: "DateTime", nullable: true }),
        createdAt: t.expose("createdAt", { type: "DateTime" }),
        updatedAt: t.expose("updatedAt", { type: "DateTime" }),
        traverse: t.field({
            type: [TraversalNode],
            args: {
                depth: t.arg.int({ required: false, defaultValue: 1 }),
                edgeType: t.arg.string({ required: false }),
                direction: t.arg.string({ required: false, defaultValue: "both" }),
                populate: t.arg.boolean({ required: false, defaultValue: false }),
            },
            resolve: async (entry, args) => {
                const result = await traverse({
                    fromEntryId: entry.id,
                    maxDepth: args.depth ?? 1,
                    direction: (args.direction ?? "both") as "inbound" | "outbound" | "both",
                    edgeTypes: args.edgeType ? [args.edgeType] : undefined,
                    includeData: args.populate ?? false,
                });
                return result.nodes;
            },
        }),
    }),
});
