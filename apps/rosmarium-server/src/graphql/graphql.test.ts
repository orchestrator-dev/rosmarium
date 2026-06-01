import { describe, it, expect, vi } from "vitest";
import { createYoga } from "graphql-yoga";

// Mock config BEFORE importing schema (schema imports config.ts at module level)
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

import { getSchema } from "./index.js";
import type { GraphQLContext } from "./context.js";
import { createDataloaders } from "./dataloaders/index.js";

// ─── Mocks ───────────────────────────────────────────────────────────────────
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
        getAll: vi.fn().mockReturnValue([
            { id: "ct-1", name: "article", displayName: "Article", description: null, fields: [], settings: {}, isSystem: false, archivedAt: null, createdBy: null, createdAt: new Date(), updatedAt: new Date() },
        ]),
        get: vi.fn().mockImplementation((name: string) => {
            if (name === "article") return { id: "ct-1", name: "article", displayName: "Article", description: null, fields: [], settings: {}, isSystem: false, archivedAt: null, createdBy: null, createdAt: new Date(), updatedAt: new Date() };
            return undefined;
        }),
        register: vi.fn(),
        update: vi.fn(),
        validateEntry: vi.fn().mockReturnValue({ valid: true, errors: [] }),
    },
}));

vi.mock("../modules/content/crud.service.js", () => ({
    contentCrudService: {
        findMany: vi.fn().mockResolvedValue({ entries: [], nextCursor: null, total: 0 }),
        findOne: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({
            id: "entry-1",
            contentTypeId: "ct-1",
            locale: "en",
            status: "draft",
            data: { title: "Test" },
            publishedAt: null,
            createdBy: "user-1",
            updatedBy: "user-1",
            createdAt: new Date(),
            updatedAt: new Date(),
        }),
        publish: vi.fn().mockResolvedValue({
            id: "entry-1",
            contentTypeId: "ct-1",
            locale: "en",
            status: "published",
            data: {},
            publishedAt: new Date(),
            createdBy: "user-1",
            updatedBy: "user-1",
            createdAt: new Date(),
            updatedAt: new Date(),
        }),
        delete: vi.fn().mockResolvedValue(undefined),
        update: vi.fn(),
    },
}));

// ─── Test helper ─────────────────────────────────────────────────────────────
function makeContext(user: GraphQLContext["user"] = null): GraphQLContext {
    return {
        user,
        dataloaders: createDataloaders(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pubsub: { subscribe: vi.fn(), publish: vi.fn() } as unknown,
        requestId: "test-req",
    };
}

const yoga = createYoga({
    schema: getSchema(),
    context: () => makeContext(),
    maskedErrors: false,
});

const authYoga = createYoga({
    schema: getSchema(),
    context: () => makeContext({ id: "user-1", email: "test@example.com", firstName: "Test", lastName: "User", isActive: true, role: "editor" }),
    maskedErrors: false,
});

// ─── Tests ───────────────────────────────────────────────────────────────────
describe("GraphQL — contentTypes query", () => {
    it("returns the list of content types", async () => {
        const res = await yoga.fetch("http://localhost/graphql", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: "{ contentTypes { id name displayName } }" }),
        });
        const json = await res.json() as unknown;
        if (json.errors) console.error(json.errors);
        expect(json.data.contentTypes).toHaveLength(1);
        expect(json.data.contentTypes[0]?.name).toBe("article");
    });

    it("returns null for unknown contentType name", async () => {
        const res = await yoga.fetch("http://localhost/graphql", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: '{ contentType(name: "nonexistent") { id } }' }),
        });
        const json = await res.json() as { data: { contentType: null } };
        expect(json.data.contentType).toBeNull();
    });
});

describe("GraphQL — entries query", () => {
    it("returns empty connection for unknown entries", async () => {
        const res = await yoga.fetch("http://localhost/graphql", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: '{ entries(contentType: "article") { totalCount edges { cursor } pageInfo { hasNextPage } } }' }),
        });
        const json = await res.json() as { data: { entries: { totalCount: number } } };
        expect(json.data.entries.totalCount).toBe(0);
    });

    it("returns null for entry query with unknown id", async () => {
        const res = await yoga.fetch("http://localhost/graphql", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: '{ entry(contentType: "article", id: "does-not-exist") { id } }' }),
        });
        const json = await res.json() as { data: { entry: null } };
        expect(json.data.entry).toBeNull();
    });
});

describe("GraphQL — createEntry mutation", () => {
    it("returns UNAUTHORIZED when user is not authenticated", async () => {
        const res = await yoga.fetch("http://localhost/graphql", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                query: `mutation { createEntry(input: { contentType: "article", data: { title: "Test" } }) { id status } }`,
            }),
        });
        const json = await res.json() as { errors: Array<{ extensions: { code: string } }> };
        expect(json.errors?.[0]?.extensions?.code).toBe("UNAUTHORIZED");
    });

    it("creates an entry when authenticated", async () => {
        const res = await authYoga.fetch("http://localhost/graphql", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                query: `mutation { createEntry(input: { contentType: "article", data: { title: "Test" } }) { id status } }`,
            }),
        });
        const json = await res.json() as { data: { createEntry: { id: string; status: string } } };
        expect(json.data.createEntry.id).toBe("entry-1");
        expect(json.data.createEntry.status).toBe("draft");
    });

    it("publishEntry changes status to published", async () => {
        const res = await authYoga.fetch("http://localhost/graphql", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: `mutation { publishEntry(contentType: "article", id: "entry-1") { id status } }` }),
        });
        const json = await res.json() as { data: { publishEntry: { status: string } } };
        expect(json.data.publishEntry.status).toBe("published");
    });
});
