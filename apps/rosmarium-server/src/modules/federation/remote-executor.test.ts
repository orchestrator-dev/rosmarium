import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { remoteExecutorService } from "./remote-executor.js";
import type { RemoteSourceModel } from "../../db/schema/index.js";
import { parse } from "graphql";

// Mock federationCacheService
const mockCacheStore = new Map<string, string>();

vi.mock("./cache.service.js", () => ({
    federationCacheService: {
        getCachedResult: vi.fn().mockImplementation(async (_sourceId: string, cacheKey: string) => {
            if (mockCacheStore.get("SWR_MODE") === "true") {
                const count = (Number(mockCacheStore.get("SWR_COUNT") || "0")) + 1;
                mockCacheStore.set("SWR_COUNT", String(count));
                if (count === 1) return null; // Miss on initial check
                return { data: { stale: true, version: "old" } }; // Hit on fallback check
            }
            const fullKey = `${_sourceId}:${cacheKey}`;
            const raw = mockCacheStore.get(fullKey);
            return raw ? JSON.parse(raw) : null;
        }),
        setCachedResult: vi.fn().mockImplementation(async (_sourceId: string, cacheKey: string, data: unknown) => {
            const fullKey = `${_sourceId}:${cacheKey}`;
            mockCacheStore.set(fullKey, JSON.stringify(data));
        }),
    },
}));

describe("Remote Executor Service", () => {
    const baseSource: RemoteSourceModel = {
        id: "source-1",
        name: "test-source",
        type: "graphql",
        endpoint: "https://api.example.com/graphql",
        authConfig: { type: "none" },
        cacheConfig: { ttl: 300, staleWhileRevalidate: false },
        rateLimitConfig: { maxRequestsPerMinute: 60, burstSize: 10 },
        fieldMappings: [],
        status: "active",
        healthCheckUrl: null,
        lastHealthCheck: null,
        lastHealthStatus: null,
        introspectedSchema: null,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    beforeEach(() => {
        mockCacheStore.clear();
        remoteExecutorService.clearTokenCache();
        remoteExecutorService.resetCircuitBreaker();
        remoteExecutorService.resetRateLimiters();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("executes a successful GraphQL request and caches the result", async () => {
        const fetchMock = vi.fn().mockImplementation(async () =>
            new Response(JSON.stringify({ data: { hello: "world" } }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            }),
        );
        vi.stubGlobal("fetch", fetchMock);

        const executor = remoteExecutorService.buildExecutor(baseSource);
        const res = await executor({
            document: parse("{ hello }"),
        });

        expect(res).toEqual({ data: { hello: "world" } });
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("serves from cache on subsequent identical requests without calling fetch", async () => {
        const fetchMock = vi.fn().mockImplementation(async () =>
            new Response(JSON.stringify({ data: { cached: true } }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            }),
        );
        vi.stubGlobal("fetch", fetchMock);

        const executor = remoteExecutorService.buildExecutor(baseSource);
        const req = { document: parse("{ hello }") };

        const res1 = await executor(req);
        const res2 = await executor(req);

        expect(res1).toEqual({ data: { cached: true } });
        expect(res2).toEqual({ data: { cached: true } });
        expect(fetchMock).toHaveBeenCalledTimes(1); // Second call served from cache
    });

    it("fetches and caches OAuth 2.0 tokens for requests requiring oauth2 auth", async () => {
        const oauthSource: RemoteSourceModel = {
            ...baseSource,
            authConfig: {
                type: "oauth2",
                clientId: "client-id",
                clientSecret: "client-secret",
                tokenUrl: "https://auth.example.com/token",
            },
        };

        const fetchMock = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
            if (url === "https://auth.example.com/token") {
                return new Response(JSON.stringify({ access_token: "mock-access-token", expires_in: 3600 }), {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                });
            }
            if (url === "https://api.example.com/graphql") {
                const authHeader = new Headers(init?.headers).get("Authorization");
                expect(authHeader).toBe("Bearer mock-access-token");
                return new Response(JSON.stringify({ data: { secured: "yes" } }), {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                });
            }
            return new Response("Not Found", { status: 404 });
        });
        vi.stubGlobal("fetch", fetchMock);

        const executor = remoteExecutorService.buildExecutor(oauthSource);
        const req1 = { document: parse("{ hello }") };
        const req2 = { document: parse("{ hello }"), extensions: { diff: 2 } }; // Different query to bypass content cache

        await executor(req1);
        await executor(req2);

        // Fetch called 3 times: 1x OAuth token, 2x GraphQL requests (token was reused from cache)
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it("rejects requests when rate limit is exceeded", async () => {
        const limitedSource: RemoteSourceModel = {
            ...baseSource,
            rateLimitConfig: { maxRequestsPerMinute: 60, burstSize: 2 },
        };

        const fetchMock = vi.fn().mockImplementation(async () =>
            new Response(JSON.stringify({ data: { ok: true } }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            }),
        );
        vi.stubGlobal("fetch", fetchMock);

        const executor = remoteExecutorService.buildExecutor(limitedSource);
        const req = (i: number) => ({ document: parse("{ hello }"), extensions: { i } });

        await executor(req(1));
        await executor(req(2));

        const res3 = await executor(req(3));
        expect(res3.errors?.[0]?.message).toMatch(/Rate limit exceeded/);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("trips circuit breaker after consecutive failures and rejects fast", async () => {
        const fetchMock = vi.fn().mockImplementation(async () => new Response("Internal Server Error", { status: 500 }));
        vi.stubGlobal("fetch", fetchMock);

        const executor = remoteExecutorService.buildExecutor(baseSource);
        const req = (i: number) => ({ document: parse("{ hello }"), extensions: { i } });

        // 5 consecutive failures trip the breaker (threshold = 5)
        for (let i = 1; i <= 5; i++) {
            const res = await executor(req(i));
            expect(res.errors?.[0]?.message).toMatch(/Upstream API returned HTTP 500/);
        }

        // 6th request fails fast without calling fetch
        const res6 = await executor(req(6));
        expect(res6.errors?.[0]?.message).toMatch(/Circuit breaker is OPEN/);
        expect(fetchMock).toHaveBeenCalledTimes(5);
    });

    it("returns stale cache when upstream fails and staleWhileRevalidate is true", async () => {
        const swrSource: RemoteSourceModel = {
            ...baseSource,
            cacheConfig: { ttl: 300, staleWhileRevalidate: true },
        };

        mockCacheStore.set("SWR_MODE", "true");

        const fetchMock = vi.fn().mockImplementation(async () => new Response("Service Unavailable", { status: 503 }));
        vi.stubGlobal("fetch", fetchMock);

        const executor = remoteExecutorService.buildExecutor(swrSource);
        const req = { document: parse("{ hello }") };

        const res = await executor(req);
        expect(res).toEqual({ data: { stale: true, version: "old" } });
    });
});
