import { createPubSub } from "graphql-yoga";
import { createRedisEventTarget } from "@graphql-yoga/redis-event-target";
import Redis from "ioredis";
import { config } from "../config.js";
import type { ContentEntry } from "../db/schema/index.js";
import type { ContentComment } from "../db/schema/comments.js"; // will create this soon

// Redis instances for PubSub
const publishClient = new Redis(config.REDIS_URL);
const subscribeClient = new Redis(config.REDIS_URL);

const eventTarget = createRedisEventTarget({
    publishClient,
    subscribeClient,
});

export const pubsub = createPubSub<{
    [key: `entry.created.${string}`]: [ContentEntry];
    [key: `entry.updated.${string}`]: [ContentEntry];
    [key: `entry.deleted.${string}`]: [{ id: string; contentType: string }];
    [key: `comment.added.${string}`]: [ContentComment];
}>({ eventTarget });
