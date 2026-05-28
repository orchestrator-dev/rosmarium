import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHmac } from "node:crypto";

// ─── BullMQ mock must be declared FIRST before any imports ────────────────────
let capturedProcessor: ((job: { data: Record<string, unknown> }) => Promise<void>) | undefined;

vi.mock("bullmq", () => ({
    Queue: vi.fn().mockImplementation(() => ({ add: vi.fn() })),
    Worker: vi.fn().mockImplementation((_q: string, fn: (job: { data: Record<string, unknown> }) => Promise<void>) => {
        capturedProcessor = fn;
        return { on: vi.fn() };
    }),
}));

vi.mock("../../config.js", () => ({
    config: {
        REDIS_URL: "redis://localhost:6379",
        NODE_ENV: "test",
        DATABASE_URL: "postgres://mock:5432/mock",
        PORT: 3000,
        HOST: "127.0.0.1",
        SESSION_SECRET: "test",
        ADMIN_EMAIL: "a@b.com",
        ADMIN_PASSWORD: "pass",
        AI_WORKER_URL: "http://localhost:8001",
        AI_WORKER_SECRET: "secret",
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

vi.mock("@paralleldrive/cuid2", () => ({ createId: () => "delivery-test-123" }));
// eslint-disable-next-line @typescript-eslint/no-unused-vars
vi.mock("drizzle-orm", () => ({ eq: vi.fn((_col: unknown, _val: unknown) => "mock-eq") }));

// DB mock — returns hook data for select queries
const mockSelectResult = vi.fn();
vi.mock("../../db/index.js", () => ({
    db: {
        select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    limit: mockSelectResult,
                }),
            }),
        }),
        insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }),
        }),
    },
}));

vi.mock("../../db/schema/index.js", () => ({
    webhooks: { id: { name: "id" }, secret: {}, isActive: {} },
    webhookDeliveries: { id: { name: "id" }, webhookId: {}, event: {}, payload: {}, responseCode: {}, responseBody: {}, durationMs: {}, success: {}, attempt: {} },
}));

// Import and initialise worker (which captures the processor)
const { getWebhookWorker } = await import("./webhook.queue.js");
getWebhookWorker(); // triggers Worker constructor which sets capturedProcessor

const makeHook = (overrides = {}) => ({
    id: "hook-1",
    url: "https://test.example.com/hook",
    secret: "my-secret",
    isActive: true,
    ...overrides,
});

describe("webhookWorker processor", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        global.fetch = vi.fn().mockResolvedValue({ status: 200, text: async () => "ok" });
    });

    it("validates that capturedProcessor is set by Worker constructor", () => {
        expect(capturedProcessor).toBeDefined();
    });

    it("signs payload with correct HMAC-SHA256 and X-Rosmarium-Signature header", async () => {
        if (!capturedProcessor) throw new Error("processor not captured");

        mockSelectResult.mockResolvedValue([makeHook()]);

        let capturedHeaders: Record<string, string> = {};
        let capturedBody = "";
        (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
            (_url: string, opts: RequestInit) => {
                capturedHeaders = opts.headers as Record<string, string>;
                capturedBody = opts.body as string;
                return Promise.resolve({ status: 200, text: async () => "ok" });
            },
        );

        await capturedProcessor({ data: { webhookId: "hook-1", event: "entry.created", contentType: "article", payload: { id: "e-1" }, attempt: 1 } });

        const expectedSig = `sha256=${createHmac("sha256", "my-secret").update(capturedBody).digest("hex")}`;
        expect(capturedHeaders["X-Rosmarium-Signature"]).toBe(expectedSig);
        expect(capturedHeaders["X-Rosmarium-Event"]).toBe("entry.created");
    });

    it("marks delivery success=true on HTTP 200", async () => {
        if (!capturedProcessor) throw new Error("processor not captured");

        mockSelectResult.mockResolvedValue([makeHook()]);
        (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ status: 200, text: async () => "ok" });

        const { db } = await import("../../db/index.js");
        const insertValuesMock = vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) });
        (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: insertValuesMock });

        await capturedProcessor({ data: { webhookId: "hook-1", event: "entry.created", contentType: "article", payload: {}, attempt: 1 } });

        expect(insertValuesMock).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it("marks delivery success=false on HTTP 500 and throws", async () => {
        if (!capturedProcessor) throw new Error("processor not captured");

        mockSelectResult.mockResolvedValue([makeHook()]);
        (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ status: 500, text: async () => "Internal Server Error" });

        const { db } = await import("../../db/index.js");
        const insertValuesMock = vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) });
        (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: insertValuesMock });

        await expect(
            capturedProcessor({ data: { webhookId: "hook-1", event: "entry.created", contentType: "article", payload: {}, attempt: 1 } }),
        ).rejects.toThrow("Webhook delivery failed");

        expect(insertValuesMock).toHaveBeenCalledWith(expect.objectContaining({ success: false, responseCode: 500 }));
    });

    it("skips processing if webhook is inactive", async () => {
        if (!capturedProcessor) throw new Error("processor not captured");

        // isActive: false → processor returns early before fetch
        mockSelectResult.mockResolvedValue([makeHook({ isActive: false })]);

        await capturedProcessor({ data: { webhookId: "hook-1", event: "entry.created", contentType: "article", payload: {}, attempt: 1 } });

        expect(global.fetch).not.toHaveBeenCalled();
    });
});
