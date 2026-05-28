import { describe, it, expect, vi } from "vitest";
import { buildApp } from "../app.js";

vi.mock("../config.js", () => ({
    config: {
        NODE_ENV: "test",
        PORT: 3000,
        HOST: "127.0.0.1",
        DATABASE_URL: "postgres://mock:5432",
        REDIS_URL: "redis://mock:6379",
    },
}));

// Mock the Drizzle db client — must include select for registry.load()
vi.mock("../db/index.js", () => ({
    db: {
        execute: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
        select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([]),
            }),
        }),
    },
    pool: {},
}));

// Mock the content registry so registry.load() is a no-op in tests
vi.mock("../modules/content/registry.js", () => ({
    registry: {
        load: vi.fn().mockResolvedValue(undefined),
        get: vi.fn().mockReturnValue(undefined),
        getAll: vi.fn().mockReturnValue([]),
    },
    ContentTypeRegistry: vi.fn(),
}));

// Mock ioredis
vi.mock("ioredis", () => ({
    Redis: vi.fn().mockImplementation(() => {
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
    }),
}));

describe("Health Routes", () => {
    it("GET /health returns 200 ok", async () => {
        const app = await buildApp();
        const response = await app.inject({
            method: "GET",
            url: "/health",
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ status: "ok", service: "rosmarium-server" });
    });

    it("GET /ready returns 200 ready when backends are up", async () => {
        const app = await buildApp();
        const response = await app.inject({
            method: "GET",
            url: "/ready",
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({
            status: "ready",
            checks: {
                postgres: true,
                redis: true,
            },
        });
    });
});
