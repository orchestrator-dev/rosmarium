import fp from "fastify-plugin";
import cors, { type FastifyCorsOptions } from "@fastify/cors";
import { config } from "../config.js";
import type { FastifyInstance } from "fastify";

export default fp<FastifyCorsOptions>(async (fastify: FastifyInstance) => {
    const origin = config.NODE_ENV === "development" ? "*" : (config.CORS_ORIGIN || false);
    await fastify.register(cors, {
        origin,
        credentials: true,
    });
});
