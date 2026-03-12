import { builder } from "../builder.js";

builder.objectType("ContentType", {
    description: "A registered content type definition",
    fields: (t) => ({
        id: t.exposeString("id"),
        name: t.exposeString("name"),
        displayName: t.exposeString("displayName"),
        description: t.expose("description", { type: "String", nullable: true }),
        fields: t.expose("fields", { type: "JSON" }),
        settings: t.expose("settings", { type: "JSON" }),
        isSystem: t.exposeBoolean("isSystem"),
        createdAt: t.expose("createdAt", { type: "DateTime" }),
        updatedAt: t.expose("updatedAt", { type: "DateTime" }),
    }),
});
