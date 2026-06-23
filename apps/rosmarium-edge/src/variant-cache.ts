// In-memory or Redis-backed cache for Edge Variants

export interface CachedVariant {
    id: string;
    segmentId: string;
    overrides: any;
}

export const variantCache = {
    // In Edge Workers, we typically use KV or memory cache
    _cache: new Map<string, CachedVariant[]>(),

    async getVariantsForEntry(entryId: string): Promise<CachedVariant[]> {
        if (this._cache.has(entryId)) {
            return this._cache.get(entryId)!;
        }

        // Fetch from Rosmarium Origin if not in edge cache
        try {
            // Placeholder: Assume API base URL is available via env
            const API_URL = (globalThis as any).ROSMARIUM_API_URL || "http://localhost:3001";
            const response = await fetch(`${API_URL}/api/personalization/variants/entry/${entryId}`);
            if (response.ok) {
                const variants = await response.json();
                this._cache.set(entryId, variants);
                return variants;
            }
        } catch (e) {
            console.error("Failed to fetch variants from origin", e);
        }

        return [];
    },

    invalidate(entryId: string) {
        this._cache.delete(entryId);
    }
};
