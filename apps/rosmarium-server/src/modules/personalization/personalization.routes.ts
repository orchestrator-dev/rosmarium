import { FastifyPluginAsync } from "fastify";
import { segmentService } from "./segment.service.js";
import { variantService } from "./variant.service.js";

export const personalizationRoutes: FastifyPluginAsync = async (fastify) => {
    // Segments
    fastify.post("/api/personalization/segments", async (request, reply) => {
        const body = request.body as any;
        return await segmentService.createSegment(body);
    });

    fastify.get("/api/personalization/segments", async (request, reply) => {
        return await segmentService.getSegments();
    });

    fastify.put("/api/personalization/segments/:id", async (request, reply) => {
        const { id } = request.params as { id: string };
        const body = request.body as any;
        return await segmentService.updateSegment(id, body);
    });

    fastify.delete("/api/personalization/segments/:id", async (request, reply) => {
        const { id } = request.params as { id: string };
        return await segmentService.deleteSegment(id);
    });

    // Variants
    fastify.post("/api/personalization/variants", async (request, reply) => {
        const body = request.body as any;
        return await variantService.createVariant(body);
    });

    fastify.get("/api/personalization/variants/entry/:baseEntryId", async (request, reply) => {
        const { baseEntryId } = request.params as { baseEntryId: string };
        return await variantService.getVariantsByBaseEntry(baseEntryId);
    });

    // Edge Analytics Metrics Tracking
    fastify.post("/api/personalization/variants/:id/impression", async (request, reply) => {
        const { id } = request.params as { id: string };
        return await variantService.recordImpression(id);
    });
};
