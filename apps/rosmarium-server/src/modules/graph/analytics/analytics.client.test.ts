import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock config before any module import that chains to config.ts ───────────
vi.mock("../../../config.js", () => ({
    config: {
        AI_WORKER_URL: "http://localhost:8001",
        AI_WORKER_SECRET: "test-secret",
    },
}));

import { analyticsClient } from "./analytics.client.js";

describe("analyticsClient", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        global.fetch = vi.fn();
    });

    it("getEntryAnalytics → returns parsed analytics on 200", async () => {
        const mockData = {
            pagerankScore: 0.1,
            betweennessScore: 0.2,
            communityId: 1,
            hubScore: 0.3,
            authorityScore: 0.4,
            degreeIn: 5,
            degreeOut: 3,
            computedAt: new Date().toISOString(),
        };

        (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
            ok: true,
            json: async () => mockData,
        });

        const res = await analyticsClient.getEntryAnalytics("test-id");
        expect(res).toEqual(mockData);
        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining("/graph/analytics/test-id"),
            expect.objectContaining({
                headers: expect.objectContaining({
                    "X-Worker-Secret": "test-secret",
                }),
            }),
        );
    });

    it("getEntryAnalytics → returns null on 404", async () => {
        (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
            ok: false,
            status: 404,
        });

        const res = await analyticsClient.getEntryAnalytics("missing-id");
        expect(res).toBeNull();
    });

    it("triggerCompute → sends POST with contentType and requestedBy", async () => {
        (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
            ok: true,
        });

        await analyticsClient.triggerCompute("article", "admin-user");

        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining("/graph/analytics/compute"),
            expect.objectContaining({
                method: "POST",
                headers: expect.objectContaining({
                    "X-Worker-Secret": "test-secret",
                    "Content-Type": "application/json",
                }),
            }),
        );

        const callArg = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
        const body = JSON.parse(callArg.body as string) as Record<string, unknown>;
        expect(body.contentType).toBe("article");
        expect(body.requestedBy).toBe("admin-user");
    });

    it("triggerCompute → uses 'system' as default requestedBy", async () => {
        (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: true });

        await analyticsClient.triggerCompute();

        const callArg = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
        const body = JSON.parse(callArg.body as string) as Record<string, unknown>;
        expect(body.requestedBy).toBe("system");
    });

    it("exportGraph → throws AnalyticsError on non-2xx", async () => {
        (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
            ok: false,
            status: 400,
            text: async () => "Bad Request",
        });

        await expect(
            analyticsClient.exportGraph({ format: "json-ld" }),
        ).rejects.toThrow("AI worker returned 400: Bad Request");
    });

    it("exportGraph → throws if response has no body", async () => {
        (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
            ok: true,
            body: null,
        });

        await expect(
            analyticsClient.exportGraph({ format: "cytoscape" }),
        ).rejects.toThrow("Response body is empty");
    });
});
