import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import sessionRoutes from "./session.js";
import apiKeyRoutes from "./api-keys.js";

const authRoutes = fp(
    async (app: FastifyInstance) => {
        await app.register(sessionRoutes);
        await app.register(apiKeyRoutes);
    },
    { name: "auth-routes" }
);

export default authRoutes;
