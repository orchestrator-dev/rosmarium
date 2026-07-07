import { FastifyPluginAsync } from "fastify";
import { segmentService } from "./segment.service.js";
import { variantService } from "./variant.service.js";
import { TraitContext } from "@orchestrator.dev/types";

export const personalizationRoutes: FastifyPluginAsync = async (fastify) => {
    // Segments
    fastify.post("/api/personalization/segments", async (request) => {
        const body = request.body as Record<string, unknown>;
        return await segmentService.createSegment(body as any);
    });

    fastify.get("/api/personalization/segments", async () => {
        return await segmentService.getSegments();
    });

    fastify.get("/api/personalization/segments/:id", async (request, reply) => {
        const { id } = request.params as { id: string };
        const segment = await segmentService.getSegmentById(id);
        if (!segment) {
            return reply.status(404).send({ error: "Segment not found" });
        }
        return segment;
    });

    fastify.put("/api/personalization/segments/:id", async (request) => {
        const { id } = request.params as { id: string };
        const body = request.body as Record<string, unknown>;
        return await segmentService.updateSegment(id, body);
    });

    fastify.delete("/api/personalization/segments/:id", async (request) => {
        const { id } = request.params as { id: string };
        return await segmentService.deleteSegment(id);
    });

    // Evaluation
    fastify.post("/api/personalization/evaluate", async (request) => {
        const body = request.body as { baseEntryId?: string; context?: TraitContext; abTestRatio?: number };
        const context = body.context || {};
        if (body.baseEntryId) {
            return await variantService.resolveVariantWithABTest(body.baseEntryId, context, body.abTestRatio);
        }
        const matchedSegment = await segmentService.evaluateAudience(context);
        return { matchedSegmentId: matchedSegment?.id || null };
    });

    // Variants
    fastify.post("/api/personalization/variants", async (request) => {
        const body = request.body as Record<string, unknown>;
        return await variantService.createVariant(body as any);
    });

    fastify.get("/api/personalization/variants/entry/:baseEntryId", async (request) => {
        const { baseEntryId } = request.params as { baseEntryId: string };
        return await variantService.getVariantsByBaseEntry(baseEntryId);
    });

    fastify.get("/api/personalization/variants/:id", async (request, reply) => {
        const { id } = request.params as { id: string };
        const variant = await variantService.getVariantById(id);
        if (!variant) {
            return reply.status(404).send({ error: "Variant not found" });
        }
        return variant;
    });

    fastify.put("/api/personalization/variants/:id", async (request) => {
        const { id } = request.params as { id: string };
        const body = request.body as Record<string, unknown>;
        return await variantService.updateVariant(id, body);
    });

    fastify.delete("/api/personalization/variants/:id", async (request) => {
        const { id } = request.params as { id: string };
        return await variantService.deleteVariant(id);
    });

    // Edge Analytics Metrics Tracking
    fastify.post("/api/personalization/variants/:id/impression", async (request) => {
        const { id } = request.params as { id: string };
        return await variantService.recordImpression(id);
    });

    fastify.post("/api/personalization/variants/:id/click", async (request) => {
        const { id } = request.params as { id: string };
        return await variantService.recordClick(id);
    });

    fastify.post("/api/personalization/variants/:id/conversion", async (request) => {
        const { id } = request.params as { id: string };
        return await variantService.recordConversion(id);
    });

    // Analytics summary dashboard
    fastify.get("/api/personalization/analytics", async () => {
        const segments = await segmentService.getSegments();
        const analytics = await Promise.all(
            segments.map(async (segment) => {
                // In a real app we might query by segmentId directly, let's filter or add a query if needed
                // For now we return segment info
                return {
                    segmentId: segment.id,
                    name: segment.name,
                    priority: segment.priority,
                    conditionsCount: segment.conditions?.length || 0,
                };
            })
        );
        return { segments: analytics };
    });
};

