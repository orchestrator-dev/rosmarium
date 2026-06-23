import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { segments } from "../../db/schema/personalization.js";
import { AudienceSegment } from "@orchestrator.dev/types/personalization";

export const segmentService = {
    async createSegment(data: Omit<AudienceSegment, "id">) {
        const [result] = await db
            .insert(segments)
            .values({
                name: data.name,
                description: data.description,
                conditions: data.conditions as any,
                logic: data.logic,
                priority: data.priority,
            })
            .returning();
        return result;
    },

    async getSegments() {
        return db.select().from(segments).orderBy(segments.priority);
    },

    async getSegmentById(id: string) {
        const [result] = await db.select().from(segments).where(eq(segments.id, id)).limit(1);
        return result;
    },

    async updateSegment(id: string, data: Partial<AudienceSegment>) {
        const [result] = await db
            .update(segments)
            .set({
                ...data,
                conditions: data.conditions as any,
                updatedAt: new Date(),
            })
            .where(eq(segments.id, id))
            .returning();
        return result;
    },

    async deleteSegment(id: string) {
        const [result] = await db.delete(segments).where(eq(segments.id, id)).returning();
        return result;
    }
};
