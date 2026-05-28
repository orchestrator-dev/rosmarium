import { builder } from "../builder.js";

builder.objectType("PageInfo", {
    description: "Relay-style pagination information",
    fields: (t) => ({
        hasNextPage: t.exposeBoolean("hasNextPage"),
        endCursor: t.expose("endCursor", { type: "String", nullable: true }),
    }),
});

builder.objectType("EntryEdge", {
    description: "An edge in a content entry connection",
    fields: (t) => ({
        node: t.field({ type: "ContentEntry", resolve: (edge) => edge.node }),
        cursor: t.exposeString("cursor"),
    }),
});

builder.objectType("EntryConnection", {
    description: "Paginated list of content entries",
    fields: (t) => ({
        edges: t.field({ type: ["EntryEdge"], resolve: (conn) => conn.edges }),
        pageInfo: t.field({ type: "PageInfo", resolve: (conn) => conn.pageInfo }),
        totalCount: t.exposeInt("totalCount"),
    }),
});

builder.objectType("DeletionPayload", {
    description: "Payload returned when a content entry is deleted",
    fields: (t) => ({
        id: t.exposeString("id"),
        contentType: t.exposeString("contentType"),
    }),
});
