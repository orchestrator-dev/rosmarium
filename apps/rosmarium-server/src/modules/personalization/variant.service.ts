import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { contentVariants } from "../../db/schema/personalization.js";
import { ContentVariant } from "@orchestrator.dev/types/personalization";

export const variantService = {
    async createVariant(data: Omit<ContentVariant, "id" | "metrics">) {
        const [result] = await db
            .insert(contentVariants)
            .values({
                baseEntryId: data.baseEntryId,
                segmentId: data.segmentId,
                overrides: data.overrides as any,
                metrics: { impressions: 0, clicks: 0, conversions: 0 },
            })
            .returning();
        return result;
    },

    async getVariantsByBaseEntry(baseEntryId: string) {
        return db.select().from(contentVariants).where(eq(contentVariants.baseEntryId, baseEntryId));
    },

    async updateVariant(id: string, data: Partial<ContentVariant>) {
        const [result] = await db
            .update(contentVariants)
            .set({
                ...data,
                overrides: data.overrides as any,
                metrics: data.metrics as any,
                updatedAt: new Date(),
            })
            .where(eq(contentVariants.id, id))
            .returning();
        return result;
    },

    async recordImpression(id: string) {
        const [variant] = await db.select().from(contentVariants).where(eq(contentVariants.id, id)).limit(1);
        if (!variant) return null;

        const metrics = variant.metrics as any;
        metrics.impressions = (metrics.impressions || 0) + 1;

        return this.updateVariant(id, { metrics });
    },

    async deleteVariant(id: string) {
        const [result] = await db.delete(contentVariants).where(eq(contentVariants.id, id)).returning();
        return result;
    }
};
