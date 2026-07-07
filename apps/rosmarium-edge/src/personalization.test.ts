import { describe, it, expect, vi, beforeEach } from "vitest";
import { extractTraits } from "./traits.js";
import { applyPersonalization, getSegmentsFromKV } from "./personalization.js";
import { variantCache } from "./variant-cache.js";

describe("Edge Personalization & Analytics (V3 Phase 3)", () => {
    beforeEach(() => {
        variantCache._cache.clear();
        vi.restoreAllMocks();
    });

    describe("Edge Trait Extraction", () => {
        it("should extract geography traits from Cloudflare/Vercel headers", () => {
            const req = new Request("http://edge.test/api/content/1", {
                headers: {
                    "cf-ipcountry": "DE",
                    "cf-ipcity": "Berlin",
                    "cf-region": "BE",
                    "cf-timezone": "Europe/Berlin",
                },
            });

            const traits = extractTraits(req);
            expect(traits.country).toBe("DE");
            expect(traits.city).toBe("Berlin");
            expect(traits.region).toBe("BE");
            expect(traits.timezone).toBe("Europe/Berlin");
        });

        it("should extract device type, browser, and OS from User-Agent", () => {
            const req = new Request("http://edge.test/api/content/1", {
                headers: {
                    "user-agent":
                        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
                },
            });

            const traits = extractTraits(req);
            expect(traits.deviceType).toBe("mobile");
            expect(traits.os).toBe("macOS");
            expect(traits.browser).toBe("Safari");
        });

        it("should extract custom traits from x-rosmarium-traits header", () => {
            const req = new Request("http://edge.test/api/content/1", {
                headers: {
                    "x-rosmarium-traits": JSON.stringify({ vipTier: "gold", ltv: 1500 }),
                },
            });

            const traits = extractTraits(req);
            expect(traits.vipTier).toBe("gold");
            expect(traits.ltv).toBe(1500);
        });

        it("should extract user segment and ID from cookies", () => {
            const req = new Request("http://edge.test/api/content/1", {
                headers: {
                    cookie: "rosmarium_user_segment=enterprise; rosmarium_user_id=usr_999; other=123",
                },
            });

            const traits = extractTraits(req);
            expect(traits.userSegment).toBe("enterprise");
            expect(traits.userId).toBe("usr_999");
            expect(traits.isLoggedIn).toBe(true);
        });
    });

    describe("Edge Segment Evaluation & KV Sync", () => {
        it("should retrieve segments from KV cache when available", async () => {
            const mockKV = {
                get: vi.fn().mockResolvedValue([
                    { id: "seg-kv", name: "KV Segment", priority: 10, conditions: [] },
                ]),
                put: vi.fn(),
            };

            const segments = await getSegmentsFromKV(mockKV, "http://test.origin");
            expect(segments).toHaveLength(1);
            expect(segments[0].id).toBe("seg-kv");
            expect(mockKV.get).toHaveBeenCalledWith("personalization:segments", "json");
        });

        it("should fetch from origin on KV miss and cache in KV", async () => {
            const mockKV = {
                get: vi.fn().mockResolvedValue(null),
                put: vi.fn().mockResolvedValue(undefined),
            };

            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve([
                    { id: "seg-origin", name: "Origin Segment", priority: 5, conditions: [] },
                ]),
            });

            const segments = await getSegmentsFromKV(mockKV, "http://test.origin");
            expect(segments).toHaveLength(1);
            expect(segments[0].id).toBe("seg-origin");
            expect(mockKV.put).toHaveBeenCalledWith("personalization:segments", expect.any(String), { expirationTtl: 300 });
        });
    });

    describe("Edge Variant Application & A/B Testing", () => {
        const baseEntry = {
            id: "entry-hero",
            title: "Default Hero Title",
            ctaText: "Get Started",
        };

        const mockSegments = [
            {
                id: "seg-mobile",
                name: "Mobile Users",
                logic: "and",
                priority: 100,
                conditions: [{ trait: "deviceType", operator: "eq", value: "mobile" }],
            },
            {
                id: "seg-us",
                name: "US Users",
                logic: "and",
                priority: 10,
                conditions: [{ trait: "country", operator: "eq", value: "US" }],
            },
        ];

        it("should apply highest priority variant overrides on segment match", async () => {
            variantCache._cache.set("entry-hero", [
                {
                    id: "var-mobile",
                    segmentId: "seg-mobile",
                    overrides: { title: "Mobile Optimized Hero", ctaText: "Tap Here" },
                },
                {
                    id: "var-us",
                    segmentId: "seg-us",
                    overrides: { title: "US Exclusive Hero" },
                },
            ]);

            const req = new Request("http://edge.test/api/content/entry-hero", {
                headers: {
                    "user-agent": "iPhone",
                    "cf-ipcountry": "US",
                },
            });

            // Mock impression fetch call
            global.fetch = vi.fn().mockResolvedValue({ ok: true });

            const result = await applyPersonalization(req, baseEntry, mockSegments);
            expect(result.isPersonalized).toBe(true);
            expect(result.segmentId).toBe("seg-mobile");
            expect(result.variantId).toBe("var-mobile");
            expect(result.content.title).toBe("Mobile Optimized Hero");
            expect(result.content.ctaText).toBe("Tap Here");
        });

        it("should return base content unchanged when no segment matches", async () => {
            const req = new Request("http://edge.test/api/content/entry-hero", {
                headers: {
                    "user-agent": "Desktop Chrome",
                    "cf-ipcountry": "FR",
                },
            });

            const result = await applyPersonalization(req, baseEntry, mockSegments);
            expect(result.isPersonalized).toBe(false);
            expect(result.content.title).toBe("Default Hero Title");
        });

        it("should perform deterministic A/B testing split assignment at edge", async () => {
            variantCache._cache.set("entry-hero", [
                {
                    id: "var-us",
                    segmentId: "seg-us",
                    overrides: { title: "Variant B Title" },
                },
            ]);

            const req = new Request("http://edge.test/api/content/entry-hero", {
                headers: {
                    "cf-ipcountry": "US",
                    cookie: "rosmarium_user_id=user-test-ab",
                },
            });

            global.fetch = vi.fn().mockResolvedValue({ ok: true });

            // With abTestRatio = 0, user should fall into control group (base content with A/B flag)
            const resControl = await applyPersonalization(req, baseEntry, mockSegments, { abTestRatio: 0.0 });
            expect(resControl.isPersonalized).toBe(true);
            expect(resControl.isABTest).toBe(true);
            expect(resControl.content._abTest).toBe(true);
            expect(resControl.content.title).toBe("Default Hero Title");

            // With abTestRatio = 1.0, user should fall into variant group
            const resVariant = await applyPersonalization(req, baseEntry, mockSegments, { abTestRatio: 1.0 });
            expect(resVariant.isPersonalized).toBe(true);
            expect(resVariant.content.title).toBe("Variant B Title");
        });
    });
});
