import { builder } from "../builder.js";
import { StatusEnum } from "./common.js";

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
    }),
});
