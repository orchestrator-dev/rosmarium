import Redis from "ioredis";
import { config } from "../../config.js";

const redis = new Redis(config.REDIS_URL, {
    keyPrefix: "federation:cache:",
});

export const federationCacheService = {
    async getCachedResult(sourceId: string, queryHash: string): Promise<any | null> {
        const key = `${sourceId}:${queryHash}`;
        const data = await redis.get(key);
        if (data) {
            return JSON.parse(data);
        }
        return null;
    },

    async setCachedResult(sourceId: string, queryHash: string, data: any, ttlSeconds: number): Promise<void> {
        const key = `${sourceId}:${queryHash}`;
        await redis.setex(key, ttlSeconds, JSON.stringify(data));
    },

    async invalidateSourceCache(sourceId: string): Promise<void> {
        const pattern = `federation:cache:${sourceId}:*`;
        let cursor = "0";
        do {
            const [nextCursor, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
            cursor = nextCursor;
            if (keys.length > 0) {
                // Remove prefix added by ioredis because we use keyPrefix option
                const keysWithoutPrefix = keys.map(k => k.replace("federation:cache:", ""));
                await redis.del(...keysWithoutPrefix);
            }
        } while (cursor !== "0");
    },
};
