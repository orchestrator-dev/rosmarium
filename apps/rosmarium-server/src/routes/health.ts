import type { FastifyPluginAsync } from "fastify";
import { config } from "../config.js";
import { Redis } from "ioredis";
import { db } from "../db/index.js";
import { sql } from "drizzle-orm";

const healthRoutes: FastifyPluginAsync = async (app) => {
    app.get("/health", async () => {
        return { status: "ok", service: "rosmarium-server" };
    });

    app.get("/ready", async (request, reply) => {
        let isRedisUp = false;
        let isPgUp = false;

        // Check Redis
        const redis = new Redis(config.REDIS_URL, {
            maxRetriesPerRequest: null,
            lazyConnect: true,
        });
        try {
            await redis.connect();
            await redis.ping();
            isRedisUp = true;
        } catch {
            isRedisUp = false;
        } finally {
            redis.disconnect();
        }

        // Check PostgreSQL via Drizzle
        try {
            await db.execute(sql`SELECT 1`);
            isPgUp = true;
        } catch {
            isPgUp = false;
        }

        const status = isPgUp && isRedisUp ? "ready" : "unavailable";

        if (status === "unavailable") {
            reply.status(503);
        }

        return {
            status,
            checks: {
                postgres: isPgUp ? "ok" : "unavailable",
                redis: isRedisUp ? "ok" : "unavailable",
            },
        };
    });
};

export default healthRoutes;
