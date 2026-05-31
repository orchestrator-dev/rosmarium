import type { FastifyInstance } from "fastify";
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import contentTypeRoutes from "./types.js";
import contentEntryRoutes from "./entries.js";
import templateRoutes from "./templates.js";
import bulkRoutes from "./bulk.js";
import hierarchyRoutes from "./hierarchy.js";

const contentRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
    await app.register(contentTypeRoutes);
    await app.register(contentEntryRoutes);
    await app.register(templateRoutes);
    await app.register(bulkRoutes);
    await app.register(hierarchyRoutes);
};

export default fp(contentRoutes, { name: "content-routes" });
