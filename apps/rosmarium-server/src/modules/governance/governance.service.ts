/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable prefer-const */
import { db } from "../../db/index.js";
import { contentEntries } from "../../db/schema/content-entries.js";

export const governanceService = {
    async getFreshnessStats() {
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        const allEntries = await db.select().from(contentEntries);
        
        let freshCount = 0;
        let outdatedCount = 0;

        for (const entry of allEntries) {
            if (entry.updatedAt < oneYearAgo) {
                outdatedCount++;
            } else {
                freshCount++;
            }
        }

        return {
            total: allEntries.length,
            freshCount,
            outdatedCount,
            freshnessScore: allEntries.length > 0 ? (freshCount / allEntries.length) * 100 : 100
        };
    },

    async getRotContent() {
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        const allEntries = await db.select().from(contentEntries);
        const rotItems = [];

        for (const entry of allEntries) {
            const isOutdated = entry.updatedAt < oneYearAgo;
            
            // Trivial check: data body length < 50
            const dataStr = JSON.stringify(entry.data || {});
            const isTrivial = dataStr.length < 50;

            if (isOutdated || isTrivial) {
                rotItems.push({
                    id: entry.id,
                    status: entry.status,
                    updatedAt: entry.updatedAt,
                    reasons: [
                        ...(isOutdated ? ["outdated"] : []),
                        ...(isTrivial ? ["trivial"] : [])
                    ]
                });
            }
        }

        return rotItems;
    },

    async getQualityScore(entryId: string) {
        return {
            score: 85,
            factors: {
                readability: "Good",
                seoComplete: true,
                hasRelations: true
            }
        };
    }
};
