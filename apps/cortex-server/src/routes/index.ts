import type { FastifyInstance } from "fastify";
import healthRoutes from "./health.js";
import authRoutes from "./auth/index.js";
import contentRoutes from "./content/index.js";
import webhookRoutes from "./webhooks.js";
import searchRoutes from "./search.js";

export const registerRoutes = async (app: FastifyInstance) => {
    await app.register(healthRoutes);
    await app.register(authRoutes);
    await app.register(contentRoutes);
    await app.register(webhookRoutes);
    await app.register(searchRoutes);
};
