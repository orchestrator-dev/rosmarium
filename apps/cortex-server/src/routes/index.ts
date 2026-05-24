import type { FastifyInstance } from "fastify";
import healthRoutes from "./health.js";
import authRoutes from "./auth/index.js";
import contentRoutes from "./content/index.js";
import webhookRoutes from "./webhooks.js";
import searchRoutes from "./search.js";
import ragRoutes from "./rag.js";
import intelligenceRoutes from "./intelligence.js";
import adminRoutes from "./admin.js";
import graphRoutes from "./graph.js";

export const registerRoutes = async (app: FastifyInstance) => {
    await app.register(healthRoutes);
    await app.register(authRoutes);
    await app.register(contentRoutes);
    await app.register(webhookRoutes);
    await app.register(searchRoutes);
    await app.register(ragRoutes);
    await app.register(intelligenceRoutes);
    await app.register(adminRoutes);
    await app.register(graphRoutes);
};

