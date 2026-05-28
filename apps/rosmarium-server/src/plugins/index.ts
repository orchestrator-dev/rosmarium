import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import sensible from "@fastify/sensible";
import cookie from "@fastify/cookie";
import corsPlugin from "./cors.js";
import helmetPlugin from "./helmet.js";
import rateLimitPlugin from "./rate-limit.js";
import swaggerPlugin from "./swagger.js";

export const registerPlugins = fp(async (app: FastifyInstance) => {
    await app.register(sensible);
    // Cookie plugin must be registered before any auth middleware reads cookies
    await app.register(cookie);
    await app.register(corsPlugin);
    await app.register(helmetPlugin);
    await app.register(rateLimitPlugin);
    await app.register(swaggerPlugin);
});
