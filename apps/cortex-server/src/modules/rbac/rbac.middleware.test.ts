import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

// ─── Mocks must be declared before importing modules ─────────────────────────

vi.mock("../../config.js", () => ({
    config: {
        NODE_ENV: "test",
        PORT: 3000,
        HOST: "127.0.0.1",
        DATABASE_URL: "postgres://mock:5432",
        REDIS_URL: "redis://mock:6379",
        SESSION_SECRET: "test-secret-that-is-at-least-32-chars!!",
        ADMIN_EMAIL: "admin@test.com",
        ADMIN_PASSWORD: "testpassword",
        STORAGE_PROVIDER: "s3",
        STORAGE_ENDPOINT: "http://localhost:9000",
        STORAGE_BUCKET: "test",
        STORAGE_REGION: "us-east-1",
        STORAGE_ACCESS_KEY: "access",
        STORAGE_SECRET_KEY: "secret",
        AI_WORKER_URL: "http://localhost:8001",
        AI_WORKER_SECRET: "secret",
        EMBEDDING_PROVIDER: "ollama",
        EMBEDDING_MODEL: "nomic-embed-text",
        OLLAMA_BASE_URL: "http://localhost:11434",
    },
}));

vi.mock("../../db/index.js", () => ({
    db: {
        select: vi.fn(),
        insert: vi.fn(),
        update: vi.fn(),
        execute: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
    },
    pool: {},
}));

vi.mock("../../modules/content/registry.js", () => ({
    registry: {
        load: vi.fn().mockResolvedValue(undefined),
        get: vi.fn().mockReturnValue(undefined),
        getAll: vi.fn().mockReturnValue([]),
    },
}));

vi.mock("ioredis", () => ({
    Redis: vi.fn().mockImplementation(() => ({
        connect: vi.fn().mockResolvedValue(undefined),
        ping: vi.fn().mockResolvedValue("PONG"),
        disconnect: vi.fn(),
        defineCommand: vi.fn(),
    })),
}));

vi.mock("../auth/auth.service.js", () => ({
    authService: {
        validateSession: vi.fn(),
    },
}));

vi.mock("../auth/api-key.service.js", () => ({
    apiKeyService: {
        validate: vi.fn(),
    },
}));

vi.mock("../auth/lucia.js", () => ({
    lucia: {
        readSessionCookie: vi.fn(),
        createSessionCookie: vi.fn().mockReturnValue({ serialize: () => "" }),
        createBlankSessionCookie: vi.fn().mockReturnValue({ serialize: () => "" }),
    },
}));

// GraphQL plugin mock
vi.mock("../../graphql/index.js", () => ({
    default: async (app: { decorate: Mock }) => {
        app.decorate?.("graphql", {});
    },
}));
vi.mock("../../graphql/context.js", () => ({
    pubsub: { publish: vi.fn() },
    createContext: vi.fn(),
}));
vi.mock("../../modules/webhooks/webhook.service.js", () => ({
    webhookService: { trigger: vi.fn() },
}));

import { buildApp } from "../../app.js";
import { authService } from "../auth/auth.service.js";
import { apiKeyService } from "../auth/api-key.service.js";
import { lucia } from "../auth/lucia.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mockUser = {
    id: "user_1",
    email: "user@example.com",
    firstName: "Test",
    lastName: "User",
    role: "editor" as const,
    isActive: true,
};

const mockSession = {
    id: "session_abc",
    userId: "user_1",
    expiresAt: new Date(Date.now() + 86400000),
    fresh: false,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("rbac.middleware — requireAuth", () => {
    beforeEach(() => { vi.clearAllMocks(); });

    it("returns 401 for unauthenticated request (no cookie, no bearer)", async () => {
        const app = await buildApp();
        (lucia.readSessionCookie as Mock).mockReturnValue(null);
        (apiKeyService.validate as Mock).mockResolvedValue({ valid: false });

        const res = await app.inject({
            method: "GET",
            url: "/api/content-types",
            headers: {},
        });

        expect(res.statusCode).toBe(401);
    });

    it("authenticates request with a valid session cookie", async () => {
        const app = await buildApp();
        (lucia.readSessionCookie as Mock).mockReturnValue("session_abc");
        (authService.validateSession as Mock).mockResolvedValue({
            user: mockUser,
            session: mockSession,
        });

        const res = await app.inject({
            method: "GET",
            url: "/api/content-types",
            headers: { cookie: "auth_session=session_abc" },
        });

        // 200 means auth passed (registry returns empty list)
        expect(res.statusCode).toBe(200);
    });

    it("authenticates request with a valid API key Bearer token", async () => {
        const app = await buildApp();
        (lucia.readSessionCookie as Mock).mockReturnValue(null);
        (apiKeyService.validate as Mock).mockResolvedValue({
            valid: true,
            user: mockUser,
        });

        const res = await app.inject({
            method: "GET",
            url: "/api/content-types",
            headers: { authorization: "Bearer ctx_live_abc123" },
        });

        expect(res.statusCode).toBe(200);
    });

    it("returns 401 for an expired API key", async () => {
        const app = await buildApp();
        (lucia.readSessionCookie as Mock).mockReturnValue(null);
        (apiKeyService.validate as Mock).mockResolvedValue({ valid: false });

        const res = await app.inject({
            method: "GET",
            url: "/api/content-types",
            headers: { authorization: "Bearer ctx_live_expired" },
        });

        expect(res.statusCode).toBe(401);
    });

    it("returns 403 for authenticated user lacking permission", async () => {
        const app = await buildApp();
        (lucia.readSessionCookie as Mock).mockReturnValue("session_abc");
        (authService.validateSession as Mock).mockResolvedValue({
            user: { ...mockUser, role: "viewer" }, // viewer has no CONTENT_TYPE_CREATE
            session: mockSession,
        });

        const res = await app.inject({
            method: "POST",
            url: "/api/content-types",
            headers: {
                cookie: "auth_session=session_abc",
                "content-type": "application/json",
            },
            body: JSON.stringify({
                name: "testType",
                displayName: "Test Type",
                fields: [],
            }),
        });

        expect(res.statusCode).toBe(403);
    });
});
