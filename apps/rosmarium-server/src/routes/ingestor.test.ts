import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildApp } from "../app.js";

// ─── Global mocks ─────────────────────────────────────────────────────────────

vi.mock("../config.js", () => ({
    config: {
        NODE_ENV: "test",
        PORT: 3000,
        HOST: "127.0.0.1",
        DATABASE_URL: "postgres://mock:5432",
        REDIS_URL: "redis://mock:6379",
    },
}));

const dbChain = vi.hoisted(() => ({
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    then: (resolve: any) => resolve([]),
}));

vi.mock("../db/index.js", () => ({
    db: {
        execute: vi.fn().mockResolvedValue([]),
        select: vi.fn().mockReturnValue(dbChain),
        insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([{
                    id: "test-set-id",
                    name: "Test Set",
                    jobId: "test-job-id",
                    status: "queued",
                    sourceUrl: "https://example.com",
                    config: {},
                    stats: {},
                    createdAt: new Date(),
                    completedAt: null,
                }]),
            }),
        }),
        update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([]),
            }),
        }),
        delete: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
        }),
    },
    pool: {},
    branchStorage: { getStore: vi.fn().mockReturnValue(null) },
}));

vi.mock("../modules/content/registry.js", () => ({
    registry: {
        load: vi.fn().mockResolvedValue(undefined),
        get: vi.fn().mockReturnValue(undefined),
        getAll: vi.fn().mockReturnValue([]),
    },
    ContentTypeRegistry: vi.fn(),
}));

vi.mock("ioredis", () => {
    const RedisMock = vi.fn().mockImplementation(() => {
        const target: Record<string, unknown> = {
            connect: vi.fn().mockResolvedValue(undefined),
            ping: vi.fn().mockResolvedValue("PONG"),
            disconnect: vi.fn(),
            defineCommand: vi.fn(),
        };
        return new Proxy(target, {
            get: (obj, prop: string) => {
                if (prop in obj) return obj[prop];
                return vi.fn().mockResolvedValue(1);
            },
        });
    });
    return { default: RedisMock, Redis: RedisMock };
});

// Mock redis for ingestor service
vi.mock("redis", () => ({
    createClient: vi.fn().mockReturnValue({
        connect: vi.fn().mockResolvedValue(undefined),
        set: vi.fn().mockResolvedValue("OK"),
        get: vi.fn().mockResolvedValue(null),
        hSet: vi.fn().mockResolvedValue(1),
        lPush: vi.fn().mockResolvedValue(1),
        quit: vi.fn().mockResolvedValue("OK"),
        subscribe: vi.fn().mockResolvedValue(undefined),
        duplicate: vi.fn().mockReturnValue({
            connect: vi.fn().mockResolvedValue(undefined),
            subscribe: vi.fn().mockImplementation(async (_channel: string, _cb: unknown) => void 0),
            quit: vi.fn().mockResolvedValue("OK"),
        }),
    }),
}));

// ─── Auth mock — returns a valid super_admin user ─────────────────────────────

vi.mock("../modules/auth/auth.service.js", () => ({
    authService: {
        validateSession: vi.fn().mockResolvedValue({
            id: "user-001",
            email: "admin@test.com",
            role: "super_admin",
            name: "Admin",
        }),
        validateApiKey: vi.fn().mockResolvedValue({
            id: "user-001",
            email: "admin@test.com",
            role: "super_admin",
            name: "Admin",
        }),
    },
}));

vi.mock("../modules/auth/api-key.service.js", () => ({
    apiKeyService: {
        validate: vi.fn().mockResolvedValue({
            valid: true,
            user: {
                id: "user-001",
                email: "admin@test.com",
                role: "super_admin",
                name: "Admin",
            },
            apiKey: { id: "key-1", scopes: ["*"] }
        }),
    },
}));

// ─── Ingestor service mock ────────────────────────────────────────────────────

vi.mock("../modules/ingestor/ingestor.service.js", () => ({
    ingestorService: {
        createJob: vi.fn().mockResolvedValue({
            jobId: "test-job-id",
            contentSetId: "test-set-id",
        }),
        listJobs: vi.fn().mockResolvedValue({
            data: [
                {
                    id: "test-set-id",
                    name: "Test Import",
                    jobId: "test-job-id",
                    status: "complete",
                    sourceUrl: "https://example.com",
                    stats: { crawledPages: 5, importedEntries: 4 },
                    createdAt: new Date("2024-01-01").toISOString(),
                },
            ],
            total: 1,
        }),
        getJob: vi.fn().mockResolvedValue({
            id: "test-set-id",
            jobId: "test-job-id",
            name: "Test Import",
            status: "complete",
        }),
        cancelJob: vi.fn().mockResolvedValue(undefined),
        rollbackJob: vi.fn().mockResolvedValue(3),
        publishAll: vi.fn().mockResolvedValue(4),
        getItems: vi.fn().mockResolvedValue({ data: [], total: 0 }),
        deleteItem: vi.fn().mockResolvedValue(undefined),
    },
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Ingestor Routes", () => {
    it("POST /api/ingestor/jobs creates content set + dispatches job", async () => {
        const app = await buildApp();

        const response = await app.inject({
            method: "POST",
            url: "/api/ingestor/jobs",
            headers: {
                "Authorization": "Bearer test-api-key",
                "Content-Type": "application/json",
            },
            payload: {
                startUrl: "https://example.com/blog",
                contentSetName: "Example Blog Import",
                maxDepth: 2,
                maxPages: 50,
                importAs: "draft",
                apiKey: "test-api-key",
            },
        });

        expect(response.statusCode).toBe(201);
        const body = response.json() as { data: { jobId: string; contentSetId: string; status: string } };
        expect(body.data.jobId).toBe("test-job-id");
        expect(body.data.contentSetId).toBe("test-set-id");
        expect(body.data.status).toBe("queued");
    });

    it("GET /api/ingestor/jobs returns list sorted by createdAt DESC", async () => {
        const app = await buildApp();

        const response = await app.inject({
            method: "GET",
            url: "/api/ingestor/jobs",
            headers: { "Authorization": "Bearer test-api-key" },
        });

        expect(response.statusCode).toBe(200);
        const body = response.json() as { data: unknown[]; total: number };
        expect(Array.isArray(body.data)).toBe(true);
        expect(body.total).toBe(1);
    });

    it("GET /api/ingestor/jobs/:jobId returns a single job", async () => {
        const app = await buildApp();

        const response = await app.inject({
            method: "GET",
            url: "/api/ingestor/jobs/test-job-id",
            headers: { "Authorization": "Bearer test-api-key" },
        });

        expect(response.statusCode).toBe(200);
        const body = response.json() as { data: { jobId: string } };
        expect(body.data.jobId).toBe("test-job-id");
    });

    it("DELETE /api/ingestor/jobs/:jobId cancels and rolls back", async () => {
        const app = await buildApp();

        const response = await app.inject({
            method: "DELETE",
            url: "/api/ingestor/jobs/test-job-id",
            headers: { "Authorization": "Bearer test-api-key" },
        });

        expect(response.statusCode).toBe(200);
        const body = response.json() as { deleted: number };
        expect(body.deleted).toBe(3);
    });

    it("POST /api/ingestor/jobs/:jobId/publish-all publishes all draft items", async () => {
        const app = await buildApp();

        const response = await app.inject({
            method: "POST",
            url: "/api/ingestor/jobs/test-job-id/publish-all",
            headers: { "Authorization": "Bearer test-api-key" },
        });

        expect(response.statusCode).toBe(200);
        const body = response.json() as { published: number };
        expect(body.published).toBe(4);
    });

    it("POST /api/ingestor/jobs validates required fields", async () => {
        const app = await buildApp();

        const response = await app.inject({
            method: "POST",
            url: "/api/ingestor/jobs",
            headers: {
                "Authorization": "Bearer test-api-key",
                "Content-Type": "application/json",
            },
            payload: {
                // Missing startUrl and contentSetName
                maxDepth: 2,
            },
        });

        expect(response.statusCode).toBe(400);
    });
});
