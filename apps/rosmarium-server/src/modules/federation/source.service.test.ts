import { describe, it, expect, beforeEach } from "vitest";
import { sourceService } from "./source.service.js";
import { db } from "../../db/index.js";
import { remoteSources } from "../../db/schema/index.js";
import { eq } from "drizzle-orm";

describe("Federation Source Service", () => {
    beforeEach(async () => {
        await db.delete(remoteSources);
    });

    it("should create a new remote source", async () => {
        const source = await sourceService.createSource({
            name: "test-shopify",
            type: "graphql",
            endpoint: "https://test.shopify.com/api/graphql",
            authConfig: { type: "none" },
            cacheConfig: { ttl: 600, staleWhileRevalidate: true },
            rateLimitConfig: { maxRequestsPerMinute: 100 },
        });

        expect(source.id).toBeDefined();
        expect(source.name).toBe("test-shopify");
        expect(source.status).toBe("active");
    });

    it("should list active sources", async () => {
        await sourceService.createSource({
            name: "test-source-1",
            type: "rest",
            endpoint: "https://api.example.com",
            authConfig: { type: "none" },
        });

        await sourceService.createSource({
            name: "test-source-2",
            type: "graphql",
            endpoint: "https://api.example.com/graphql",
            authConfig: { type: "none" },
        });

        const sources = await sourceService.listSources();
        expect(sources.length).toBe(2);
    });

    it("should get a specific source by id", async () => {
        const created = await sourceService.createSource({
            name: "test-fetch",
            type: "openapi",
            endpoint: "https://api.test.com",
            authConfig: { type: "none" },
        });

        const source = await sourceService.getSource(created.id);
        expect(source).toBeDefined();
        expect(source?.name).toBe("test-fetch");
    });

    it("should delete a source", async () => {
        const created = await sourceService.createSource({
            name: "test-delete",
            type: "rest",
            endpoint: "https://api.test.com",
            authConfig: { type: "none" },
        });

        await sourceService.deleteSource(created.id);
        const source = await sourceService.getSource(created.id);
        expect(source).toBeUndefined();
    });
});
