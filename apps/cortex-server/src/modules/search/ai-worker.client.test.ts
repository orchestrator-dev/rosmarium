/**
 * Unit tests for the AI worker HTTP client.
 * Mocks global fetch — no real network calls.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    aiWorkerClient,
    SearchEmbeddingError,
} from "./ai-worker.client.js";

// Mock config
vi.mock("../../config.js", () => ({
    config: {
        AI_WORKER_URL: "http://localhost:8001",
        AI_WORKER_SECRET: "test-secret",
    },
}));

// Mock logger
vi.mock("../../lib/logger.js", () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockFetch(response: {
    ok: boolean;
    status?: number;
    body?: unknown;
}): void {
    global.fetch = vi.fn().mockResolvedValue({
        ok: response.ok,
        status: response.status ?? (response.ok ? 200 : 500),
        json: vi.fn().mockResolvedValue(response.body ?? {}),
    }) as unknown as typeof fetch;
}

const SAMPLE_EMBED_RESPONSE = {
    embedding: [0.1, 0.2, 0.3],
    dimensions: 3,
    model: "nomic-embed-text",
    latency_ms: 42,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("aiWorkerClient.embedQuery", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it("sends correct headers including X-Worker-Secret", async () => {
        mockFetch({ ok: true, body: SAMPLE_EMBED_RESPONSE });

        await aiWorkerClient.embedQuery("test query");

        expect(global.fetch).toHaveBeenCalledWith(
            "http://localhost:8001/search/embed",
            expect.objectContaining({
                method: "POST",
                headers: expect.objectContaining({
                    "X-Worker-Secret": "test-secret",
                    "Content-Type": "application/json",
                }),
            })
        );
    });

    it("does NOT include query text in request body as a readable log (body is JSON stringified)", async () => {
        mockFetch({ ok: true, body: SAMPLE_EMBED_RESPONSE });
        // We're testing that the body contains the expected structure
        await aiWorkerClient.embedQuery("my search query");

        const callArgs = vi.mocked(global.fetch).mock.calls[0];
        const body = JSON.parse(callArgs?.[1]?.body as string);
        expect(body).toMatchObject({ input_type: "search_query" });
        expect(body.text).toBe("my search query"); // text IS in body (for AI worker), just not logged
    });

    it("returns parsed EmbedQueryResponse on success", async () => {
        mockFetch({ ok: true, body: SAMPLE_EMBED_RESPONSE });

        const result = await aiWorkerClient.embedQuery("hello");

        expect(result).toMatchObject({
            embedding: [0.1, 0.2, 0.3],
            dimensions: 3,
            model: "nomic-embed-text",
            latencyMs: 42,
        });
    });

    it("throws SearchEmbeddingError on non-2xx response", async () => {
        mockFetch({ ok: false, status: 503 });

        await expect(aiWorkerClient.embedQuery("hello")).rejects.toThrow(
            SearchEmbeddingError
        );
        await expect(aiWorkerClient.embedQuery("hello")).rejects.toMatchObject({
            code: "EMBEDDING_HTTP_ERROR",
        });
    });

    it("throws SearchEmbeddingError with EMBEDDING_TIMEOUT code on abort", async () => {
        // Simulate fetch that never resolves and gets aborted
        global.fetch = vi.fn().mockImplementation(
            () =>
                new Promise((_, reject) => {
                    setTimeout(() => {
                        const err = new Error("The operation was aborted.");
                        err.name = "AbortError";
                        reject(err);
                    }, 100);
                })
        ) as unknown as typeof fetch;

        // Advance timers past the 5s timeout
        const promise = aiWorkerClient.embedQuery("hello");
        vi.advanceTimersByTime(6000);

        await expect(promise).rejects.toMatchObject({
            code: "EMBEDDING_TIMEOUT",
        });
    });

    it("throws SearchEmbeddingError with EMBEDDING_NETWORK_ERROR on network failure", async () => {
        global.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED")) as unknown as typeof fetch;

        await expect(aiWorkerClient.embedQuery("hello")).rejects.toMatchObject({
            code: "EMBEDDING_NETWORK_ERROR",
        });
    });
});

describe("aiWorkerClient.healthCheck", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("returns true when the health endpoint responds 200", async () => {
        global.fetch = vi.fn().mockResolvedValue({ ok: true }) as unknown as typeof fetch;
        expect(await aiWorkerClient.healthCheck()).toBe(true);
    });

    it("returns false when the health endpoint is unreachable", async () => {
        global.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED")) as unknown as typeof fetch;
        expect(await aiWorkerClient.healthCheck()).toBe(false);
    });

    it("returns false when the health endpoint returns non-2xx", async () => {
        global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 }) as unknown as typeof fetch;
        expect(await aiWorkerClient.healthCheck()).toBe(false);
    });
});
