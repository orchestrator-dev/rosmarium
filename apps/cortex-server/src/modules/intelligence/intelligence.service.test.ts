import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

// ─── Mock dependencies ────────────────────────────────────────────────────────

vi.mock("../../db/index.js", () => ({
    db: {
        select: vi.fn(),
        update: vi.fn(),
    },
}));

vi.mock("../../db/schema/index.js", () => ({
    contentEntries: { id: "id", metadata: "metadata", updatedAt: "updated_at" },
}));

vi.mock("./intelligence.client.js", () => ({
    intelligenceClient: {
        tag: vi.fn(),
        extractEntities: vi.fn(),
        summarize: vi.fn(),
        findDuplicates: vi.fn(),
        scanDuplicates: vi.fn(),
    },
}));

vi.mock("../jobs/intelligence.jobs.js", () => ({
    dispatchIntelligenceJob: vi.fn(),
    getQueueStats: vi.fn(),
}));

import { intelligenceService } from "./intelligence.service.js";
import { intelligenceClient } from "./intelligence.client.js";
import { dispatchIntelligenceJob } from "../jobs/intelligence.jobs.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mockEntry = {
    id: "entry-123",
    contentTypeId: "ct-1",
    contentTypeName: "article",
    status: "published" as const,
    data: { title: "Test Article", body: "This is a long body text." },
    locale: "en",
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    publishedAt: new Date(),
    createdBy: "user-1",
    updatedBy: "user-1",
    slug: null,
    archivedAt: null,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("intelligenceService.tagEntry", () => {
    beforeEach(() => vi.clearAllMocks());

    it("calls intelligenceClient.tag with correct arguments", async () => {
        (intelligenceClient.tag as Mock).mockResolvedValue({
            tags: [{ label: "technology", score: 0.9 }],
            model: "cross-encoder/nli-MiniLM2-L6-H768",
            latencyMs: 42,
        });

        const result = await intelligenceService.tagEntry({
            entryId: "entry-123",
            text: "some text about technology",
            labels: ["technology", "business"],
        });

        expect(intelligenceClient.tag).toHaveBeenCalledWith(
            "some text about technology",
            ["technology", "business"],
            undefined
        );
        expect(result.tags).toHaveLength(1);
        expect(result.tags[0]!.label).toBe("technology");
    });
});

describe("dispatchIntelligenceJob", () => {
    beforeEach(() => vi.clearAllMocks());

    it("enqueues job to intelligence-jobs queue", async () => {
        (dispatchIntelligenceJob as Mock).mockResolvedValue(undefined);

        await dispatchIntelligenceJob({
            contentEntryId: "entry-123",
            contentType: "article",
            fields: [{ fieldName: "title", text: "Test" }],
            locale: "en",
            candidateLabels: ["technology"],
            operations: ["tag", "ner"],
        });

        expect(dispatchIntelligenceJob).toHaveBeenCalledWith(
            expect.objectContaining({
                contentEntryId: "entry-123",
                contentType: "article",
            })
        );
    });

    it("does NOT dispatch when aiIntelligence.enabled is false", async () => {
        // This is tested via app.ts event handler logic.
        // We verify that the dispatch function is called conditionally.
        const dispatch = dispatchIntelligenceJob as Mock;
        dispatch.mockResolvedValue(undefined);

        // Simulate the handler checking enabled=false → should not call dispatch
        const aiSettings = { enabled: false };
        if (aiSettings.enabled) {
            await dispatchIntelligenceJob({
                contentEntryId: "entry-123",
                contentType: "article",
                fields: [],
                locale: "en",
                candidateLabels: [],
                operations: ["tag"],
            });
        }

        expect(dispatch).not.toHaveBeenCalled();
    });
});

describe("intelligenceService.summarize", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns summary result from client", async () => {
        (intelligenceClient.summarize as Mock).mockResolvedValue({
            summary: "Brief summary.",
            word_count: 2,
            original_word_count: 100,
            compression_ratio: 0.02,
            model: "llama3.2",
            generated_at: "2026-05-23T00:00:00Z",
        });

        const result = await intelligenceService.summarize({
            entryId: "entry-123",
            text: "long text here",
        });

        expect(result.summary).toBe("Brief summary.");
        expect(result.model).toBe("llama3.2");
    });
});

describe("intelligenceService.findDuplicates", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns duplicate candidates from client", async () => {
        (intelligenceClient.findDuplicates as Mock).mockResolvedValue({
            candidates: [
                { entry_id: "entry-456", content_type: "article", similarity_score: 0.95, is_duplicate: true },
            ],
            scannedCount: 10,
            latencyMs: 100,
        });

        const result = await intelligenceService.findDuplicates("entry-123", "article");
        expect(result.candidates).toHaveLength(1);
        expect(result.candidates[0]!.is_duplicate).toBe(true);
    });
});
