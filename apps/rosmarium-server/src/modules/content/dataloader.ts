import DataLoader from "dataloader";
import { db } from "../../db/index.js";
import { contentEntries, type ContentEntry } from "../../db/schema/index.js";
import { inArray } from "drizzle-orm";
import { contentCacheService } from "./cache.service.js";

/**
 * Creates a new DataLoader instance for fetching ContentEntry by ID.
 * This should typically be instantiated per request.
 */
export function createContentLoader() {
  return new DataLoader<string, ContentEntry | null>(async (ids) => {
    // 1. Check Redis cache via MGET
    const cachedEntries = await contentCacheService.mget(ids as string[]);
    
    // 2. Identify missing IDs
    const missingIds: string[] = [];
    const missingIndices: number[] = [];
    
    cachedEntries.forEach((entry, idx) => {
      if (!entry) {
        missingIds.push(ids[idx]);
        missingIndices.push(idx);
      }
    });

    // 3. Fetch missing from DB using a single query
    const fetchedEntries: ContentEntry[] = [];
    if (missingIds.length > 0) {
      const rows = await db
        .select()
        .from(contentEntries)
        .where(inArray(contentEntries.id, missingIds));
        
      fetchedEntries.push(...rows);
      
      // Update cache
      await contentCacheService.mset(rows);
    }

    // 4. Reconstruct results in original order
    const fetchedMap = new Map(fetchedEntries.map(e => [e.id, e]));
    
    return ids.map((id, idx) => {
      if (cachedEntries[idx]) return cachedEntries[idx];
      return fetchedMap.get(id) || null;
    });
  });
}
