import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { pubsub } from "./pubsub.js";
import { config } from "../config.js";
import Redis from "ioredis";

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
        const payload = [{ id: "test-1", contentTypeId: "test-ct", tenantId: "t1", status: "published", data: {}, metadata: {}, createdAt: new Date(), updatedAt: new Date(), createdBy: "u1", updatedBy: "u1" }] as any;
        
        let received: any = null;
        
        // Subscribe
        const id = pubsub.subscribe("entry.created.test-ct", (data) => {
            received = data;
        });

        // Wait a bit to ensure subscribe is registered in redis
        await new Promise(r => setTimeout(r, 100));

        // Publish
        pubsub.publish("entry.created.test-ct", payload);

        // Wait for event delivery
        await new Promise(r => setTimeout(r, 100));

        expect(received).toEqual(payload);
        
        pubsub.unsubscribe(id);
    });

    it("should subscribe to and receive entry.updated events", async () => {
        const payload = [{ id: "test-2" }] as any;
        let received: any = null;
        const id = pubsub.subscribe("entry.updated.test-ct", (data) => { received = data; });
        await new Promise(r => setTimeout(r, 100));
        pubsub.publish("entry.updated.test-ct", payload);
        await new Promise(r => setTimeout(r, 100));
        expect(received).toEqual(payload);
        pubsub.unsubscribe(id);
    });

    it("should subscribe to and receive entry.deleted events", async () => {
        const payload = [{ id: "test-3", contentType: "test-ct" }] as any;
        let received: any = null;
        const id = pubsub.subscribe("entry.deleted.test-ct", (data) => { received = data; });
        await new Promise(r => setTimeout(r, 100));
        pubsub.publish("entry.deleted.test-ct", payload);
        await new Promise(r => setTimeout(r, 100));
        expect(received).toEqual(payload);
        pubsub.unsubscribe(id);
    });

    it("should subscribe to and receive comment.added events", async () => {
        const payload = [{ id: "comment-1", entryId: "test-1", content: "test" }] as any;
        let received: any = null;
        const id = pubsub.subscribe("comment.added.test-1", (data) => { received = data; });
        await new Promise(r => setTimeout(r, 100));
        pubsub.publish("comment.added.test-1", payload);
        await new Promise(r => setTimeout(r, 100));
        expect(received).toEqual(payload);
        pubsub.unsubscribe(id);
    });

    it("should not receive events for other channels", async () => {
        const payload = [{ id: "test-other" }] as any;
        let received: any = null;
        const id = pubsub.subscribe("entry.created.other-ct", (data) => { received = data; });
        await new Promise(r => setTimeout(r, 100));
        pubsub.publish("entry.created.test-ct", payload); // Publish to a different channel
        await new Promise(r => setTimeout(r, 100));
        expect(received).toBeNull();
        pubsub.unsubscribe(id);
    });
});
