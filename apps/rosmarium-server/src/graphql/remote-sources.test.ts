import { describe, it, expect, vi } from "vitest";
import { createYoga } from "graphql-yoga";

vi.mock("../config.js", () => ({
    config: {
        NODE_ENV: "test",
        PORT: 3000,
        HOST: "127.0.0.1",
        DATABASE_URL: "postgres://mock:5432/mock",
        REDIS_URL: "redis://localhost:6379",
        SESSION_SECRET: "test-secret",
        ADMIN_EMAIL: "admin@test.com",
        ADMIN_PASSWORD: "password",
        AI_WORKER_URL: "http://localhost:8001",
        AI_WORKER_SECRET: "worker-secret",
        STORAGE_PROVIDER: "s3",
        STORAGE_ENDPOINT: "http://localhost:9000",
        STORAGE_BUCKET: "rosmarium",
        STORAGE_REGION: "us-east-1",
        STORAGE_ACCESS_KEY: "key",
        STORAGE_SECRET_KEY: "secret",
        EMBEDDING_PROVIDER: "ollama",
        EMBEDDING_MODEL: "nomic-embed-text",
        OLLAMA_BASE_URL: "http://localhost:11434",
        LOG_LEVEL: "silent",
    },
}));

vi.mock("../db/index.js", () => ({
    db: {
        select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([]),
                    offset: vi.fn().mockReturnValue({ orderBy: vi.fn().mockResolvedValue([]) }),
                }),
                limit: vi.fn().mockResolvedValue([]),
                offset: vi.fn().mockReturnValue({ orderBy: vi.fn().mockResolvedValue([]) }),
            }),
        }),
        insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }),
        }),
        update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }),
            }),
        }),
        delete: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }),
        }),
        execute: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
    },
}));

vi.mock("../modules/content/registry.js", () => ({
    registry: {
        load: vi.fn().mockResolvedValue(undefined),
        getAll: vi.fn().mockReturnValue([]),
        get: vi.fn().mockReturnValue(undefined),
        register: vi.fn(),
        update: vi.fn(),
        validateEntry: vi.fn().mockReturnValue({ valid: true, errors: [] }),
    },
}));

vi.mock("../modules/federation/stitcher.js", () => ({
    stitcherService: {
        stitch: vi.fn().mockImplementation((schema) => schema),
    },
}));

vi.mock("../modules/federation/source.service.js", () => ({
    sourceService: {
        listSources: vi.fn().mockResolvedValue([
            {
                id: "rs-1",
                name: "shopify",
                type: "graphql",
                endpoint: "https://shopify.com/graphql",
                authConfig: { type: "none" },
                cacheConfig: { ttl: 300 },
                rateLimitConfig: { maxRequestsPerMinute: 60 },
                fieldMappings: [],
                status: "active",
                healthCheckUrl: null,
                lastHealthCheck: null,
                lastHealthStatus: null,
                introspectedSchema: null,
                createdAt: new Date("2026-01-01T00:00:00Z"),
                updatedAt: new Date("2026-01-01T00:00:00Z"),
            },
        ]),
        getSource: vi.fn().mockImplementation(async (id: string) => {
            if (id === "rs-1") {
                return {
                    id: "rs-1",
                    name: "shopify",
                    type: "graphql",
                    endpoint: "https://shopify.com/graphql",
                    authConfig: { type: "none" },
                    cacheConfig: { ttl: 300 },
                    rateLimitConfig: { maxRequestsPerMinute: 60 },
                    fieldMappings: [],
                    status: "active",
                    healthCheckUrl: null,
                    lastHealthCheck: null,
                    lastHealthStatus: null,
                    introspectedSchema: null,
                    createdAt: new Date("2026-01-01T00:00:00Z"),
                    updatedAt: new Date("2026-01-01T00:00:00Z"),
                };
            }
            return undefined;
        }),
        createSource: vi.fn().mockResolvedValue({
            id: "rs-2",
            name: "stripe",
            type: "rest",
            endpoint: "https://api.stripe.com",
            authConfig: { type: "none" },
            cacheConfig: { ttl: 300 },
            rateLimitConfig: { maxRequestsPerMinute: 60 },
            fieldMappings: [],
            status: "active",
            healthCheckUrl: null,
            lastHealthCheck: null,
            lastHealthStatus: null,
            introspectedSchema: null,
            createdAt: new Date("2026-01-01T00:00:00Z"),
            updatedAt: new Date("2026-01-01T00:00:00Z"),
        }),
        updateSource: vi.fn().mockResolvedValue({
            id: "rs-1",
            name: "shopify-updated",
            type: "graphql",
            endpoint: "https://shopify.com/graphql",
            authConfig: { type: "none" },
            cacheConfig: { ttl: 300 },
            rateLimitConfig: { maxRequestsPerMinute: 60 },
            fieldMappings: [],
            status: "active",
            healthCheckUrl: null,
            lastHealthCheck: null,
            lastHealthStatus: null,
            introspectedSchema: null,
            createdAt: new Date("2026-01-01T00:00:00Z"),
            updatedAt: new Date("2026-01-01T00:00:00Z"),
        }),
        deleteSource: vi.fn().mockResolvedValue(undefined),
        checkHealth: vi.fn().mockResolvedValue({
            healthy: true,
            status: "healthy",
            message: "Connection successful (HTTP 200)",
        }),
    },
}));

import { getSchema } from "./index.js";
import type { GraphQLContext } from "./context.js";
import { createDataloaders } from "./dataloaders/index.js";

function makeContext(user: GraphQLContext["user"] = null): GraphQLContext {
    return {
        user,
        dataloaders: createDataloaders(),
        pubsub: { subscribe: vi.fn(), publish: vi.fn() } as unknown as GraphQLContext["pubsub"],
        requestId: "test-req",
    };
}

const unauthYoga = createYoga({
    schema: getSchema(),
    context: () => makeContext(),
    maskedErrors: false,
});

const editorYoga = createYoga({
    schema: getSchema(),
    context: () => makeContext({ id: "user-1", email: "editor@test.com", firstName: "Ed", lastName: "Itor", isActive: true, role: "editor" }),
    maskedErrors: false,
});

const adminYoga = createYoga({
    schema: getSchema(),
    context: () => makeContext({ id: "admin-1", email: "admin@test.com", firstName: "Ad", lastName: "Min", isActive: true, role: "admin" }),
    maskedErrors: false,
});

describe("GraphQL — remoteSources query", () => {
    it("returns the list of remote sources", async () => {
        const res = await unauthYoga.fetch("http://localhost/graphql", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: "{ remoteSources { id name type endpoint status } }" }),
        });
        const json = await res.json() as { data: { remoteSources: Array<{ id: string; name: string; type: string }> }; errors?: unknown[] };
        expect(json.errors).toBeUndefined();
        expect(json.data.remoteSources).toHaveLength(1);
        expect(json.data.remoteSources[0]?.name).toBe("shopify");
        expect(json.data.remoteSources[0]?.type).toBe("graphql");
    });

    it("returns a specific remote source by ID", async () => {
        const res = await unauthYoga.fetch("http://localhost/graphql", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: '{ remoteSource(id: "rs-1") { id name } }' }),
        });
        const json = await res.json() as { data: { remoteSource: { id: string; name: string } | null } };
        expect(json.data.remoteSource?.name).toBe("shopify");
    });

    it("returns null when remote source ID is unknown", async () => {
        const res = await unauthYoga.fetch("http://localhost/graphql", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: '{ remoteSource(id: "nonexistent") { id } }' }),
        });
        const json = await res.json() as { data: { remoteSource: null } };
        expect(json.data.remoteSource).toBeNull();
    });
});

describe("GraphQL — remote sources mutations", () => {
    it("prevents unauthenticated users from registering remote sources", async () => {
        const res = await unauthYoga.fetch("http://localhost/graphql", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                query: `mutation { registerRemoteSource(input: { name: "test", type: "graphql", endpoint: "https://test.com" }) { id } }`,
            }),
        });
        const json = await res.json() as { errors: Array<{ extensions: { code: string } }> };
        expect(json.errors?.[0]?.extensions?.code).toBe("UNAUTHORIZED");
    });

    it("prevents non-admin users from registering remote sources", async () => {
        const res = await editorYoga.fetch("http://localhost/graphql", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                query: `mutation { registerRemoteSource(input: { name: "test", type: "graphql", endpoint: "https://test.com" }) { id } }`,
            }),
        });
        const json = await res.json() as { errors: Array<{ extensions: { code: string } }> };
        expect(json.errors?.[0]?.extensions?.code).toBe("FORBIDDEN");
    });

    it("allows admin users to register a remote source", async () => {
        const res = await adminYoga.fetch("http://localhost/graphql", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                query: `mutation { registerRemoteSource(input: { name: "stripe", type: "rest", endpoint: "https://api.stripe.com" }) { id name type } }`,
            }),
        });
        const json = await res.json() as { data: { registerRemoteSource: { id: string; name: string; type: string } } };
        expect(json.data.registerRemoteSource.name).toBe("stripe");
        expect(json.data.registerRemoteSource.type).toBe("rest");
    });

    it("allows admin users to update a remote source", async () => {
        const res = await adminYoga.fetch("http://localhost/graphql", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                query: `mutation { updateRemoteSource(input: { id: "rs-1", name: "shopify-updated" }) { id name } }`,
            }),
        });
        const json = await res.json() as { data: { updateRemoteSource: { id: string; name: string } } };
        expect(json.data.updateRemoteSource.name).toBe("shopify-updated");
    });

    it("allows admin users to delete a remote source", async () => {
        const res = await adminYoga.fetch("http://localhost/graphql", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                query: `mutation { deleteRemoteSource(id: "rs-1") }`,
            }),
        });
        const json = await res.json() as { data: { deleteRemoteSource: boolean } };
        expect(json.data.deleteRemoteSource).toBe(true);
    });

    it("allows admin users to trigger a connection health check", async () => {
        const res = await adminYoga.fetch("http://localhost/graphql", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                query: `mutation { checkRemoteSourceHealth(id: "rs-1") { healthy status message } }`,
            }),
        });
        const json = await res.json() as { data: { checkRemoteSourceHealth: { healthy: boolean; status: string; message: string } } };
        expect(json.data.checkRemoteSourceHealth.healthy).toBe(true);
        expect(json.data.checkRemoteSourceHealth.status).toBe("healthy");
    });
});
