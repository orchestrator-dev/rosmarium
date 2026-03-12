import fp from "fastify-plugin";
import rateLimit, { type RateLimitPluginOptions } from "@fastify/rate-limit";
import { config } from "../config.js";
import type { FastifyInstance } from "fastify";

export default fp<RateLimitPluginOptions>(async (fastify: FastifyInstance) => {
    const isTest = config.NODE_ENV === "test";

    await fastify.register(rateLimit, {
        max: 1000,
        timeWindow: "1 minute",
        ...(isTest ? {} : { redis: new (await import("ioredis")).Redis(config.REDIS_URL, { lazyConnect: true }) }),
        skipOnError: true,
    });
});
