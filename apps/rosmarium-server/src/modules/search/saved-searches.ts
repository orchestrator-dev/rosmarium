import { db } from "../../db/index.js";
import { savedSearches } from "../../db/schema/saved-searches.js";
import { eq, and } from "drizzle-orm";

export const savedSearchService = {
    async saveSearch(userId: string, query: string, filters: Record<string, unknown>, notifyOnNew: boolean = false) {
        const result = await db.insert(savedSearches).values({
            userId,
            query,
            filters,
            notifyOnNew,
        }).returning();

        return result[0];
    },

    async getUserSavedSearches(userId: string) {
        return db.select().from(savedSearches).where(eq(savedSearches.userId, userId));
    },

    async deleteSavedSearch(userId: string, searchId: string) {
        await db.delete(savedSearches).where(and(eq(savedSearches.id, searchId), eq(savedSearches.userId, userId)));
        return true;
    }
};
