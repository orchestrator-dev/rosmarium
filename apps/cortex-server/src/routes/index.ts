import type { FastifyInstance } from "fastify";
import healthRoutes from "./health.js";
import contentRoutes from "./content/index.js";

export const registerRoutes = async (app: FastifyInstance) => {
    await app.register(healthRoutes);
    await app.register(contentRoutes);
};
