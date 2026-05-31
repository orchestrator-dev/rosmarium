import { db } from "../../db/index.js";
import { contentComments, NewContentComment, ContentComment } from "../../db/schema/comments.js";
import { eq, and, asc } from "drizzle-orm";
import { pubsub } from "../../graphql/context.js";
import { webhookService } from "../webhooks/webhook.service.js";

export const commentsService = {
    async create(data: Omit<NewContentComment, "id" | "createdAt" | "resolved">): Promise<ContentComment> {
        const [comment] = await db
            .insert(contentComments)
            .values({ ...data, resolved: false })
            .returning();
        if (!comment) throw new Error("Failed to create comment");

        // Publish to GraphQL Subscription
        pubsub.publish(`comment.added.${comment.entryId}`, comment);

        // trigger webhook for mentions, etc
        // A full implementation would parse `@mention` from `data.content` and send notifications.
        await webhookService.trigger("comment.created", "system", comment);

        return comment;
    },

    async listByEntry(entryId: string): Promise<ContentComment[]> {
        return db.query.contentComments.findMany({
            where: eq(contentComments.entryId, entryId),
            orderBy: [asc(contentComments.createdAt)],
        });
    },

    async listByField(entryId: string, fieldId: string): Promise<ContentComment[]> {
        return db.query.contentComments.findMany({
            where: and(
                eq(contentComments.entryId, entryId),
                eq(contentComments.fieldId, fieldId)
            ),
            orderBy: [asc(contentComments.createdAt)],
        });
    },

    async resolve(commentId: string): Promise<ContentComment> {
        const [comment] = await db
            .update(contentComments)
            .set({ resolved: true })
            .where(eq(contentComments.id, commentId))
            .returning();
        if (!comment) throw new Error("Comment not found");
        return comment;
    },

    async delete(commentId: string): Promise<void> {
        await db.delete(contentComments).where(eq(contentComments.id, commentId));
    }
};
