import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { contentVariants } from "../../db/schema/personalization.js";
import { ContentVariant, TraitContext, PersonalizationEvaluationResult } from "@orchestrator.dev/types";
import { segmentService } from "./segment.service.js";

export const variantService = {
    async createVariant(data: Omit<ContentVariant, "id" | "metrics">): Promise<ContentVariant> {
        const [result] = await db
            .insert(contentVariants)
            .values({
                baseEntryId: data.baseEntryId,
                segmentId: data.segmentId,
                overrides: data.overrides as unknown as Record<string, unknown>,
                metrics: { impressions: 0, clicks: 0, conversions: 0 },
            })
            .returning();
        return result as unknown as ContentVariant;
    },

    async getVariantsByBaseEntry(baseEntryId: string): Promise<ContentVariant[]> {
        const results = await db.select().from(contentVariants).where(eq(contentVariants.baseEntryId, baseEntryId));
        return results as unknown as ContentVariant[];
    },

    async getVariantById(id: string): Promise<ContentVariant | null> {
        const [result] = await db.select().from(contentVariants).where(eq(contentVariants.id, id)).limit(1);
        return (result as unknown as ContentVariant) || null;
    },

    async updateVariant(id: string, data: Partial<ContentVariant>): Promise<ContentVariant | null> {
        const setPayload: Record<string, unknown> = { updatedAt: new Date() };
        if (data.baseEntryId !== undefined) setPayload.baseEntryId = data.baseEntryId;
        if (data.segmentId !== undefined) setPayload.segmentId = data.segmentId;
        if (data.overrides !== undefined) setPayload.overrides = data.overrides;
        if (data.metrics !== undefined) setPayload.metrics = data.metrics;

        const [result] = await db
            .update(contentVariants)
            .set(setPayload)
            .where(eq(contentVariants.id, id))
            .returning();
        return (result as unknown as ContentVariant) || null;
    },

    async recordImpression(id: string): Promise<ContentVariant | null> {
        const variant = await this.getVariantById(id);
        if (!variant) return null;

        const metrics = {
            ...variant.metrics,
            impressions: (variant.metrics?.impressions || 0) + 1,
        };

        return this.updateVariant(id, { metrics });
    },

    async recordClick(id: string): Promise<ContentVariant | null> {
        const variant = await this.getVariantById(id);
        if (!variant) return null;

        const metrics = {
            ...variant.metrics,
            clicks: (variant.metrics?.clicks || 0) + 1,
        };

        return this.updateVariant(id, { metrics });
    },

    async recordConversion(id: string): Promise<ContentVariant | null> {
        const variant = await this.getVariantById(id);
        if (!variant) return null;

        const metrics = {
            ...variant.metrics,
            conversions: (variant.metrics?.conversions || 0) + 1,
        };

        return this.updateVariant(id, { metrics });
    },

    async deleteVariant(id: string): Promise<ContentVariant | null> {
        const [result] = await db.delete(contentVariants).where(eq(contentVariants.id, id)).returning();
        return (result as unknown as ContentVariant) || null;
    },

    async resolveVariant(baseEntryId: string, context: TraitContext): Promise<PersonalizationEvaluationResult> {
        const matchedSegment = await segmentService.evaluateAudience(context);
        if (!matchedSegment) {
            return {
                matchedSegmentId: null,
                variantId: null,
                overrides: {},
            };
        }

        const variants = await this.getVariantsByBaseEntry(baseEntryId);
        const variant = variants.find((v) => v.segmentId === matchedSegment.id);

        if (!variant) {
            return {
                matchedSegmentId: matchedSegment.id,
                variantId: null,
                overrides: {},
            };
        }

        return {
            matchedSegmentId: matchedSegment.id,
            variantId: variant.id,
            overrides: variant.overrides || {},
        };
    },

    async resolveVariantWithABTest(
        baseEntryId: string,
        context: TraitContext,
        abTestRatio = 0.5
    ): Promise<PersonalizationEvaluationResult> {
        const result = await this.resolveVariant(baseEntryId, context);
        if (!result.variantId) {
            return result;
        }

        // Deterministic split based on user id or session if available, otherwise random
        const identifier = (context.userId || context.userSegment || context.country || "anonymous") as string;
        let hash = 0;
        for (let i = 0; i < identifier.length; i++) {
            hash = (hash << 5) - hash + identifier.charCodeAt(i);
            hash |= 0;
        }
        const normalizedHash = Math.abs(hash % 100) / 100.0;

        const useVariant = normalizedHash < abTestRatio;
        if (!useVariant) {
            return {
                matchedSegmentId: result.matchedSegmentId,
                variantId: result.variantId,
                overrides: {},
                isABTest: true,
            };
        }

        return {
            ...result,
            isABTest: true,
        };
    },
};

