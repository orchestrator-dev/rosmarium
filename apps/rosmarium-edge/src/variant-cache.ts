/* eslint-disable @typescript-eslint/no-explicit-any */
// In-memory or KV-backed cache for Edge Variants

export interface CachedVariant {
    id: string;
    segmentId: string;
    overrides: any;
}

export const variantCache = {
    // In Edge Workers, we typically use KV or memory cache
    _cache: new Map<string, CachedVariant[]>(),

    async getVariantsForEntry(entryId: string, kv?: any, originUrl?: string): Promise<CachedVariant[]> {
        if (this._cache.has(entryId)) {
            return this._cache.get(entryId)!;
        }

        if (kv) {
            const kvCached = await kv.get(`personalization:variants:${entryId}`, "json");
            if (kvCached && Array.isArray(kvCached)) {
                this._cache.set(entryId, kvCached);
                return kvCached;
            }
        }

        // Fetch from Rosmarium Origin if not in edge cache
        try {
            const API_URL = originUrl || (globalThis as any).ROSMARIUM_API_URL || "http://localhost:3001";
            const response = await fetch(`${API_URL}/api/personalization/variants/entry/${entryId}`);
            if (response.ok) {
                const variants = (await response.json()) as CachedVariant[];
                this._cache.set(entryId, variants);
                if (kv && Array.isArray(variants)) {
                    await kv.put(`personalization:variants:${entryId}`, JSON.stringify(variants), { expirationTtl: 300 });
                }
                return variants;
            }
        } catch (e) {
            console.error("Failed to fetch variants from origin", e);
        }

        return [];
    },

    async invalidate(entryId: string, kv?: any) {
        this._cache.delete(entryId);
        if (kv) {
            await kv.delete(`personalization:variants:${entryId}`);
        }
    },
};
