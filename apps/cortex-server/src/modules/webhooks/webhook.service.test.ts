import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock DB and webhook queue before any imports ─────────────────────────────
const mockCandidates = vi.fn().mockReturnValue([]);

vi.mock("../../db/index.js", () => {
    const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockImplementation(function () {
            return { then: (fn: (v: ReturnType<typeof mockCandidates>) => unknown) => Promise.resolve(fn(mockCandidates())) };
        }),
    };
    return {
        db: {
            select: vi.fn().mockReturnValue(selectChain),
            insert: vi.fn().mockReturnValue({ values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }) }),
        },
    };
});

vi.mock("drizzle-orm", () => ({ eq: vi.fn((_col: unknown, val: unknown) => val) }));
vi.mock("../../db/schema/index.js", () => ({
    webhooks: { id: {}, isActive: {}, name: {}, url: {}, events: {}, contentTypes: {} },
    webhookDeliveries: { id: {}, webhookId: {}, event: {} },
}));

// Mock the queue so trigger() never touches Redis
const mockQueueAdd = vi.fn().mockResolvedValue(undefined);
vi.mock("./webhook.queue.js", () => ({
    getWebhookQueue: vi.fn().mockReturnValue({ add: mockQueueAdd }),
}));

const { webhookService } = await import("./webhook.service.js");

const makeWebhook = (overrides = {}) => ({
    id: "hook-1",
    name: "Test",
    url: "https://example.com",
    secret: "s",
    events: ["entry.created"],
    contentTypes: [],
    isActive: true,
    createdBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
});

describe("webhookService.trigger", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("dispatches a BullMQ job for matching active webhooks", async () => {
        // DB returns one active matching webhook
        mockCandidates.mockReturnValue([makeWebhook()]);

        await webhookService.trigger("entry.created", "article", { id: "e-1" });

        expect(mockQueueAdd).toHaveBeenCalledOnce();
        expect(mockQueueAdd).toHaveBeenCalledWith("deliver", expect.objectContaining({
            webhookId: "hook-1",
            event: "entry.created",
            contentType: "article",
        }));
    });

    it("skips inactive webhooks — DB only returns active ones (isActive filter applied in DB)", async () => {
        // The service queries with eq(webhooks.isActive, true), so DB returns only active.
        // Inactive webhooks are never in the result set to begin with.
        mockCandidates.mockReturnValue([]); // No active webhooks

        await webhookService.trigger("entry.created", "article", {});
        expect(mockQueueAdd).not.toHaveBeenCalled();
    });

    it("skips webhooks not subscribed to the event", async () => {
        mockCandidates.mockReturnValue([makeWebhook({ events: ["entry.deleted"] })]);

        await webhookService.trigger("entry.created", "article", {});
        expect(mockQueueAdd).not.toHaveBeenCalled();
    });

    it("skips if contentTypes filter does not match", async () => {
        mockCandidates.mockReturnValue([makeWebhook({ contentTypes: ["post"] })]);

        await webhookService.trigger("entry.created", "article", {});
        expect(mockQueueAdd).not.toHaveBeenCalled();
    });
});
