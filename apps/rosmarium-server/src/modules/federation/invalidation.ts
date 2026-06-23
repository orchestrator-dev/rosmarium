import { FastifyPluginAsync } from "fastify";
import { federationCacheService } from "./cache.service.js";

export const invalidationRoutes: FastifyPluginAsync = async (fastify) => {
    fastify.post("/invalidation/webhook", async (request, reply) => {
        const payload = request.body as any;
        const sourceId = payload?.sourceId;

        if (!sourceId) {
            return reply.code(400).send({ error: "sourceId is required" });
        }

        // Validate webhook signature if applicable
        // ...

        await federationCacheService.invalidateSourceCache(sourceId);

        return reply.code(200).send({ success: true, message: `Cache invalidated for source ${sourceId}` });
    });
};
