/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, @typescript-eslint/ban-ts-comment */
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { pubsub } from "./pubsub.js";
import { config } from "../config.js";
import Redis from "ioredis";
import { getSchema } from "./index.js";
import type { GraphQLContext } from "./context.js";
import { createYoga } from "graphql-yoga";

// Verify Redis is running for integration tests
const testClient = new Redis(config.REDIS_URL);

describe("Redis PubSub Integration", () => {
    beforeAll(async () => {
        // Wait for connection
        if (testClient.status !== "ready") {
            await new Promise((resolve) => testClient.once("ready", resolve));
        }
    });

    afterAll(() => {
        testClient.disconnect();
    });

    it("should subscribe to and receive entry.created events", async () => {
        const payload = [{ id: "test-1", contentTypeId: "test-ct", tenantId: "t1", status: "published", data: {}, metadata: {}, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), createdBy: "u1", updatedBy: "u1" }] as any;
        
        // Subscribe returns an AsyncIterable
        const iterator = pubsub.subscribe("entry.created.test-ct")[Symbol.asyncIterator]();

        // Start listening (promise is pending)
        const nextPromise = iterator.next();

        // Publish
        pubsub.publish("entry.created.test-ct", payload);

        // Wait for event delivery
        const result = await nextPromise;
        
        expect(result.value).toEqual(payload);
        
        iterator.return?.();
    });

    it("should subscribe to and receive entry.updated events", async () => {
        const payload = [{ id: "test-2" }] as any;
        const iterator = pubsub.subscribe("entry.updated.test-ct")[Symbol.asyncIterator]();
        const nextPromise = iterator.next();
        pubsub.publish("entry.updated.test-ct", payload);
        const result = await nextPromise;
        expect(result.value).toEqual(payload);
        iterator.return?.();
    });

    it("should subscribe to and receive entry.deleted events", async () => {
        const payload = [{ id: "test-3", contentType: "test-ct" }] as any;
        const iterator = pubsub.subscribe("entry.deleted.test-ct")[Symbol.asyncIterator]();
        const nextPromise = iterator.next();
        pubsub.publish("entry.deleted.test-ct", payload);
        const result = await nextPromise;
        expect(result.value).toEqual(payload);
        iterator.return?.();
    });

    it("should subscribe to and receive comment.added events", async () => {
        const yoga = createYoga({
            schema: getSchema(),
            context: () => ({ user: { id: "user-1", role: "admin" } } as unknown as GraphQLContext)
        });
        const payload = [{ id: "comment-1", entryId: "test-1", content: "test" }] as any;
        const iterator = pubsub.subscribe("comment.added.test-1")[Symbol.asyncIterator]();
        const nextPromise = iterator.next();
        pubsub.publish("comment.added.test-1", payload);
        const result = await nextPromise;
        expect(result.value).toEqual(payload);
        iterator.return?.();
    });

    it("should not receive events for other channels", async () => {
        const payload = [{ id: "test-other" }] as any;
        const iterator = pubsub.subscribe("entry.created.other-ct")[Symbol.asyncIterator]();
        const nextPromise = iterator.next();
        
        pubsub.publish("entry.created.test-ct", payload); // Publish to a different channel
        
        let received = null;
        try {
            const result = await Promise.race([
                nextPromise,
                new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 200))
            ]);
            received = result.value;
        } catch (e) {
            received = null;
        }
        
        expect(received).toBeNull();
        iterator.return?.();
    });
});
