import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Mock global fetch ────────────────────────────────────────────────────────

vi.mock("../../config.js", () => ({
    config: {
        AI_WORKER_URL: "http://ai-worker:8001",
        AI_WORKER_SECRET: "test-secret",
    },
}));

import { ragClient, RagRetrievalError } from "./rag.client.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest() {
    return {
        query: "test query",
        contentTypes: ["article"],
        allowedEntryIds: [],
        topK: 5,
    };
}

function makeSseStream(events: Array<{ event: string; data: unknown }>): ReadableStream<Uint8Array> {
    const lines: string[] = [];
    for (const { event, data } of events) {
        lines.push(`event: ${event}`);
        lines.push(`data: ${JSON.stringify(data)}`);
        lines.push("");
        lines.push("");
    }
    const text = lines.join("\n");
    const encoder = new TextEncoder();
    const encoded = encoder.encode(text);

    return new ReadableStream({
        start(controller) {
            controller.enqueue(encoded);
            controller.close();
        },
    });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ragClient.retrieve", () => {
    beforeEach(() => {
        vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("sends X-Worker-Secret header", async () => {
        const mockFetch = vi.fn().mockResolvedValue(
            new Response(
                JSON.stringify({ chunks: [], query: "test", total: 0, latency_ms: 10, reranked: false }),
                { status: 200, headers: { "Content-Type": "application/json" } }
            )
        );
        vi.stubGlobal("fetch", mockFetch);

        await ragClient.retrieve(makeRequest());

        const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
        const headers = options.headers as Record<string, string>;
        expect(headers["X-Worker-Secret"]).toBe("test-secret");
    });

    it("throws RagRetrievalError on non-2xx response", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(
                new Response("Internal Server Error", { status: 500 })
            )
        );

        await expect(ragClient.retrieve(makeRequest())).rejects.toBeInstanceOf(RagRetrievalError);
    });

    it("throws RagRetrievalError with timeout message on AbortError", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockRejectedValue(Object.assign(new Error("aborted"), { name: "AbortError" }))
        );

        await expect(ragClient.retrieve(makeRequest())).rejects.toMatchObject({
            name: "RagRetrievalError",
            message: expect.stringContaining("timed out"),
        });
    });

    it("maps snake_case fields to camelCase in returned chunks", async () => {
        const rawChunk = {
            content_entry_id: "entry-1",
            content_type: "article",
            chunk_index: 2,
            chunk_text: "Hello world",
            score: 0.9,
            freshness_score: 0.85,
            published_at: "2024-01-01T00:00:00Z",
            metadata: { locale: "en" },
        };

        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(
                new Response(
                    JSON.stringify({ chunks: [rawChunk], query: "test", total: 1, latency_ms: 25, reranked: false }),
                    { status: 200, headers: { "Content-Type": "application/json" } }
                )
            )
        );

        const result = await ragClient.retrieve(makeRequest());
        expect(result.chunks[0]?.contentEntryId).toBe("entry-1");
        expect(result.chunks[0]?.freshnessScore).toBe(0.85);
        expect(result.chunks[0]?.chunkText).toBe("Hello world");
    });
});

describe("ragClient.retrieveStream", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("yields chunk events then done event in order", async () => {
        const sseEvents = [
            {
                event: "chunk",
                data: {
                    chunk_index: 0,
                    content_entry_id: "entry-1",
                    content_type: "article",
                    chunk_text: "Hello",
                    score: 0.9,
                    freshness_score: 0.85,
                    published_at: null,
                    metadata: {},
                },
            },
            { event: "done", data: { total: 1, latency_ms: 30, reranked: false } },
        ];

        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(
                new Response(makeSseStream(sseEvents), {
                    status: 200,
                    headers: { "Content-Type": "text/event-stream" },
                })
            )
        );

        const events: unknown[] = [];
        for await (const event of ragClient.retrieveStream(makeRequest())) {
            events.push(event);
        }

        expect(events).toHaveLength(2);
        expect((events[0] as { type: string }).type).toBe("chunk");
        expect((events[1] as { type: string }).type).toBe("done");
    });

    it("closes generator after done event", async () => {
        const sseEvents = [
            { event: "done", data: { total: 0, latency_ms: 5, reranked: false } },
        ];

        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(
                new Response(makeSseStream(sseEvents), {
                    status: 200,
                    headers: { "Content-Type": "text/event-stream" },
                })
            )
        );

        const events: unknown[] = [];
        for await (const event of ragClient.retrieveStream(makeRequest())) {
            events.push(event);
        }

        // Only the done event, nothing more
        expect(events).toHaveLength(1);
        expect((events[0] as { type: string }).type).toBe("done");
    });

    it("throws RagRetrievalError on non-2xx response for stream", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(new Response("Forbidden", { status: 403 }))
        );

        const gen = ragClient.retrieveStream(makeRequest());
        await expect(gen.next()).rejects.toBeInstanceOf(RagRetrievalError);
    });
});
