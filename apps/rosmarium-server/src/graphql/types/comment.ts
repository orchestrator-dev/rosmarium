import { builder } from "../builder.js";
import type { ContentComment } from "../../db/schema/comments.js";

export const commentType = builder.objectRef<ContentComment>("ContentComment").implement({
    description: "A comment on a content entry",
    fields: (t) => ({
        id: t.exposeString("id"),
        entryId: t.exposeString("entryId"),
        fieldId: t.exposeString("fieldId", { nullable: true }),
        content: t.exposeString("content"),
        authorId: t.exposeString("authorId"),
        resolved: t.exposeBoolean("resolved"),
        parentId: t.exposeString("parentId", { nullable: true }),
        createdAt: t.string({
            resolve: (comment) => comment.createdAt.toISOString(),
        }),
    }),
});
