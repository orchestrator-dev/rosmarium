import { describe, it, expect, beforeEach, vi } from "vitest";
import { createId } from "@paralleldrive/cuid2";

let mockSegments: any[] = [];
let mockVariants: any[] = [];

vi.mock("drizzle-orm", () => ({
    eq: (col: any, val: any) => ({ __col: col, __val: val, __type: "eq" }),
}));

vi.mock("../../db/index.js", () => {
    const getColKey = (col: any) => {
        if (typeof col === "string") return col;
        const raw = col.name || col.key || col._name || col.columnName || col;
        return raw.replace(/_([a-z])/g, (_: any, l: string) => l.toUpperCase());
    };

    const matchesCond = (item: any, cond: any) => {
        if (!cond) return true;
        if (cond.__type === "eq") {
            const key = getColKey(cond.__col);
            return item[key] === cond.__val;
        }
        return true;
    };

    const db = {
        transaction: async (cb: any) => cb(db),
        insert: (table: any) => ({
            values: (val: any) => {
                const isVariantTable = Boolean(
                    table?.baseEntryId || table?.segmentId || table?.overrides || val?.baseEntryId || val?.segmentId || val?.overrides
                );
                const store = isVariantTable ? mockVariants : mockSegments;
                const arr = Array.isArray(val) ? val : [val];
                const inserted = arr.map((item) => ({
                    id: item.id || createId(),
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    ...item,
                }));
                store.push(...inserted);
                return {
                    returning: async () => inserted,
                    then: (resolve: any, reject: any) => Promise.resolve(inserted).then(resolve, reject),
                };
            },
        }),
        select: () => ({
            from: (table: any) => {
                const isVariantTable = Boolean(table?.baseEntryId || table?.segmentId || table?.overrides);
                const store = isVariantTable ? mockVariants : mockSegments;

                return {
                    orderBy: async (col: any) => {
                        return [...store].sort((a, b) => {
                            if (!isVariantTable) return (a.priority ?? 0) - (b.priority ?? 0);
                            return a.createdAt > b.createdAt ? 1 : -1;
                        });
                    },
                    where: (cond: any) => {
                        const filtered = store.filter((item) => matchesCond(item, cond));
                        return {
                            limit: async (n: number) => filtered.slice(0, n),
                            orderBy: async (col: any) => {
                                return [...filtered].sort((a, b) => {
                                    if (!isVariantTable) return (a.priority ?? 0) - (b.priority ?? 0);
                                    return a.createdAt > b.createdAt ? 1 : -1;
                                });
                            },
                            then: (resolve: any, reject: any) => Promise.resolve(filtered).then(resolve, reject),
                        };
                    },
                    then: (resolve: any, reject: any) => Promise.resolve(store).then(resolve, reject),
                };
            },
        }),
        update: (table: any) => ({
            set: (val: any) => ({
                where: (cond: any) => {
                    const isVariantTable = Boolean(table?.baseEntryId || table?.segmentId || table?.overrides);
                    const store = isVariantTable ? mockVariants : mockSegments;
                    const updated: any[] = [];

                    if (isVariantTable) {
                        mockVariants = mockVariants.map((item) => {
                            if (matchesCond(item, cond)) {
                                const mod = { ...item, ...val, updatedAt: new Date() };
                                updated.push(mod);
                                return mod;
                            }
                            return item;
                        });
                    } else {
                        mockSegments = mockSegments.map((item) => {
                            if (matchesCond(item, cond)) {
                                const mod = { ...item, ...val, updatedAt: new Date() };
                                updated.push(mod);
                                return mod;
                            }
                            return item;
                        });
                    }

                    return {
                        returning: async () => updated,
                        then: (resolve: any, reject: any) => Promise.resolve(updated).then(resolve, reject),
                    };
                },
            }),
        }),
        delete: (table: any) => ({
            where: (cond: any) => {
                const isVariantTable = Boolean(table?.baseEntryId || table?.segmentId || table?.overrides);
                const deleted: any[] = [];

                if (isVariantTable) {
                    mockVariants = mockVariants.filter((item) => {
                        if (matchesCond(item, cond)) {
                            deleted.push(item);
                            return false;
                        }
                        return true;
                    });
                } else {
                    mockSegments = mockSegments.filter((item) => {
                        if (matchesCond(item, cond)) {
                            deleted.push(item);
                            return false;
                        }
                        return true;
                    });
                }

                return {
                    returning: async () => deleted,
                    then: (resolve: any, reject: any) => Promise.resolve(deleted).then(resolve, reject),
                };
            },
        }),
    };
    return { db };
});

import { segmentService, evaluateCondition, evaluateSegment } from "./segment.service.js";
import { variantService } from "./variant.service.js";

describe("Audience Segmentation & Variant Resolution (V3 Phase 3)", () => {
    beforeEach(() => {
        mockSegments = [];
        mockVariants = [];
    });

    describe("Trait Matching & Condition Evaluation", () => {
        const context = {
            country: "US",
            deviceType: "mobile" as const,
            userSegment: "vip",
            isLoggedIn: true,
            geo: {
                city: "San Francisco",
                timezone: "PST",
            },
            visits: 10,
        };

        it("should evaluate eq and neq operators accurately", () => {
            expect(evaluateCondition({ trait: "country", operator: "eq", value: "us" }, context)).toBe(true);
            expect(evaluateCondition({ trait: "country", operator: "eq", value: "UK" }, context)).toBe(false);
            expect(evaluateCondition({ trait: "deviceType", operator: "neq", value: "desktop" }, context)).toBe(true);
        });

        it("should evaluate nested trait paths (geo.city)", () => {
            expect(evaluateCondition({ trait: "geo.city", operator: "eq", value: "San Francisco" }, context)).toBe(true);
            expect(evaluateCondition({ trait: "geo.timezone", operator: "eq", value: "EST" }, context)).toBe(false);
        });

        it("should evaluate in and contains operators", () => {
            expect(evaluateCondition({ trait: "country", operator: "in", value: ["US", "CA", "MX"] }, context)).toBe(true);
            expect(evaluateCondition({ trait: "userSegment", operator: "in", value: "vip, pro, enterprise" }, context)).toBe(true);
            expect(evaluateCondition({ trait: "geo.city", operator: "contains", value: "Francisco" }, context)).toBe(true);
        });

        it("should evaluate gt and lt numerical comparisons", () => {
            expect(evaluateCondition({ trait: "visits", operator: "gt", value: 5 }, context)).toBe(true);
            expect(evaluateCondition({ trait: "visits", operator: "lt", value: 5 }, context)).toBe(false);
        });

        it("should evaluate regex operator", () => {
            expect(evaluateCondition({ trait: "geo.city", operator: "regex", value: "^San.*" }, context)).toBe(true);
            expect(evaluateCondition({ trait: "geo.city", operator: "regex", value: "^New.*" }, context)).toBe(false);
        });
    });

    describe("Segment Evaluation Logic (AND / OR)", () => {
        it("should evaluate AND logic where all conditions must match", () => {
            const segment = {
                id: "seg-1",
                name: "US Mobile VIPs",
                description: "US users on mobile",
                logic: "and" as const,
                priority: 10,
                conditions: [
                    { trait: "country", operator: "eq" as const, value: "US" },
                    { trait: "deviceType", operator: "eq" as const, value: "mobile" },
                ],
            };

            expect(evaluateSegment(segment, { country: "US", deviceType: "mobile" })).toBe(true);
            expect(evaluateSegment(segment, { country: "US", deviceType: "desktop" })).toBe(false);
        });

        it("should evaluate OR logic where any condition matches", () => {
            const segment = {
                id: "seg-2",
                name: "North America",
                description: "US or CA users",
                logic: "or" as const,
                priority: 5,
                conditions: [
                    { trait: "country", operator: "eq" as const, value: "US" },
                    { trait: "country", operator: "eq" as const, value: "CA" },
                ],
            };

            expect(evaluateSegment(segment, { country: "CA" })).toBe(true);
            expect(evaluateSegment(segment, { country: "UK" })).toBe(false);
        });
    });

    describe("Segment Service CRUD & Priority Resolution", () => {
        it("should create and retrieve segments ordered by priority", async () => {
            await segmentService.createSegment({
                name: "Low Priority Segment",
                description: "Priority 10",
                logic: "and",
                priority: 10,
                conditions: [{ trait: "country", operator: "eq", value: "US" }],
            });

            await segmentService.createSegment({
                name: "High Priority Segment",
                description: "Priority 100",
                logic: "and",
                priority: 100,
                conditions: [{ trait: "country", operator: "eq", value: "US" }],
            });

            const segments = await segmentService.getSegments();
            expect(segments).toHaveLength(2);

            // Evaluate audience should return High Priority Segment first
            const matched = await segmentService.evaluateAudience({ country: "US" });
            expect(matched?.name).toBe("High Priority Segment");
            expect(matched?.priority).toBe(100);
        });
    });

    describe("Variant Resolution & A/B Split Testing", () => {
        it("should resolve base entry overrides when segment matches", async () => {
            const seg = await segmentService.createSegment({
                name: "Mobile Users",
                description: "Mobile viewport",
                logic: "and",
                priority: 50,
                conditions: [{ trait: "deviceType", operator: "eq", value: "mobile" }],
            });

            await variantService.createVariant({
                baseEntryId: "entry-hero-banner",
                segmentId: seg.id,
                overrides: {
                    title: "Welcome Mobile VIP!",
                    ctaButtonText: "Tap Here",
                },
            });

            const resolution = await variantService.resolveVariant("entry-hero-banner", { deviceType: "mobile" });
            expect(resolution.matchedSegmentId).toBe(seg.id);
            expect(resolution.variantId).toBeDefined();
            expect(resolution.overrides).toEqual({
                title: "Welcome Mobile VIP!",
                ctaButtonText: "Tap Here",
            });
        });

        it("should return empty overrides when no segment matches", async () => {
            const resolution = await variantService.resolveVariant("entry-hero-banner", { deviceType: "desktop" });
            expect(resolution.matchedSegmentId).toBeNull();
            expect(resolution.variantId).toBeNull();
            expect(resolution.overrides).toEqual({});
        });

        it("should record impression, click, and conversion metrics on variant", async () => {
            const seg = await segmentService.createSegment({
                name: "Test Segment",
                description: "Test",
                logic: "and",
                priority: 10,
                conditions: [],
            });

            const variant = await variantService.createVariant({
                baseEntryId: "entry-100",
                segmentId: seg.id,
                overrides: { title: "Test Variant" },
            });

            await variantService.recordImpression(variant.id);
            await variantService.recordImpression(variant.id);
            await variantService.recordClick(variant.id);
            await variantService.recordConversion(variant.id);

            const updated = await variantService.getVariantById(variant.id);
            expect(updated?.metrics?.impressions).toBe(2);
            expect(updated?.metrics?.clicks).toBe(1);
            expect(updated?.metrics?.conversions).toBe(1);
        });

        it("should perform deterministic A/B split assignment", async () => {
            const seg = await segmentService.createSegment({
                name: "All Users",
                description: "All",
                logic: "and",
                priority: 1,
                conditions: [],
            });

            await variantService.createVariant({
                baseEntryId: "entry-ab-test",
                segmentId: seg.id,
                overrides: { title: "Variant B" },
            });

            // With ratio 0, user should never get variant
            const res0 = await variantService.resolveVariantWithABTest("entry-ab-test", { userId: "user-123" }, 0.0);
            expect(res0.isABTest).toBe(true);
            expect(res0.overrides).toEqual({});

            // With ratio 1, user should always get variant
            const res1 = await variantService.resolveVariantWithABTest("entry-ab-test", { userId: "user-123" }, 1.0);
            expect(res1.isABTest).toBe(true);
            expect(res1.overrides).toEqual({ title: "Variant B" });
        });
    });
});
