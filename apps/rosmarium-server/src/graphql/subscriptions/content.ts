import { builder } from "../builder.js";
import type { ContentEntry } from "../../db/schema/index.js";

builder.subscriptionField("onEntryCreated", (t) =>
    t.field({
        type: "ContentEntry",
        description: "Subscribe to new entries for a content type",
        args: { contentType: t.arg.string({ required: true }) },
        subscribe: (_, { contentType }, ctx) =>
            ctx.pubsub.subscribe(`entry.created.${contentType}`) as AsyncGenerator<ContentEntry>,
        resolve: (payload: ContentEntry) => payload,
    }),
);

builder.subscriptionField("onEntryUpdated", (t) =>
    t.field({
        type: "ContentEntry",
        nullable: true,
        description: "Subscribe to entry updates (optionally filter by entry id)",
        args: {
            contentType: t.arg.string({ required: true }),
            id: t.arg.string(),
        },
        subscribe: (_, { contentType }, ctx) =>
            ctx.pubsub.subscribe(`entry.updated.${contentType}`) as AsyncGenerator<ContentEntry>,
        resolve: (payload: ContentEntry, { id }) => {
            if (id && payload.id !== id) return null;
            return payload;
        },
    }),
);

builder.subscriptionField("onEntryDeleted", (t) =>
    t.field({
        type: "DeletionPayload",
        description: "Subscribe to entry deletions for a content type",
        args: { contentType: t.arg.string({ required: true }) },
        subscribe: (_, { contentType }, ctx) =>
            ctx.pubsub.subscribe(`entry.deleted.${contentType}`) as AsyncGenerator<{ id: string; contentType: string }>,
        resolve: (payload: { id: string; contentType: string }) => payload,
    }),
);
