import { expect, test, describe } from "vitest";
import { governanceService } from "./governance.service.js";

describe("Governance Service", () => {
    test("should return freshness stats", async () => {
        const stats = await governanceService.getFreshnessStats();
        expect(stats).toBeDefined();
        expect(stats.total).toBeGreaterThanOrEqual(0);
        expect(stats.freshCount).toBeGreaterThanOrEqual(0);
        expect(stats.outdatedCount).toBeGreaterThanOrEqual(0);
    });

    test("should return ROT content", async () => {
        const rot = await governanceService.getRotContent();
        expect(Array.isArray(rot)).toBe(true);
    });

    test("should return quality score", async () => {
        const score = await governanceService.getQualityScore("test-id");
        expect(score.score).toBe(85);
        expect(score.factors.readability).toBe("Good");
    });
});
