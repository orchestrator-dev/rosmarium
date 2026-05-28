import type { FastifyInstance } from "fastify";
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import contentTypeRoutes from "./types.js";
import contentEntryRoutes from "./entries.js";

const contentRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
    await app.register(contentTypeRoutes);
    await app.register(contentEntryRoutes);
};

export default fp(contentRoutes, { name: "content-routes" });
