import { extractTraits } from "./traits.js";
import { variantCache, CachedVariant } from "./variant-cache.js";

// Evaluates a condition against user traits
const evaluateCondition = (condition: any, traits: any): boolean => {
    const value = traits[condition.trait];
    switch (condition.operator) {
        case 'eq': return value === condition.value;
        case 'neq': return value !== condition.value;
        case 'in': return Array.isArray(condition.value) && condition.value.includes(value);
        case 'contains': return typeof value === 'string' && value.includes(condition.value);
        default: return false; // Unsupported or unhandled in edge for safety
    }
};

// Simplified segment evaluation for Edge
// In reality, segment logic might be synced to edge or we might just use segment IDs if evaluated elsewhere
const evaluateSegments = async (traits: any, segments: any[]): Promise<string[]> => {
    const matchedSegmentIds: string[] = [];
    
    for (const segment of segments) {
        let isMatch = false;
        if (segment.logic === 'and') {
            isMatch = segment.conditions.every((c: any) => evaluateCondition(c, traits));
        } else {
            isMatch = segment.conditions.some((c: any) => evaluateCondition(c, traits));
        }

        if (isMatch) {
            matchedSegmentIds.push(segment.id);
        }
    }

    return matchedSegmentIds;
};

export const applyPersonalization = async (request: Request, entry: any, segments: any[]) => {
    const traits = extractTraits(request);
    const matchedSegmentIds = await evaluateSegments(traits, segments);

    if (matchedSegmentIds.length === 0) {
        return entry; // No personalization
    }

    // Fetch variants for this entry
    const variants = await variantCache.getVariantsForEntry(entry.id);
    
    // Find the best variant (e.g., first one matching a segment)
    // Could enhance with priority sorting
    const matchingVariant = variants.find(v => matchedSegmentIds.includes(v.segmentId));

    if (matchingVariant) {
        // Record impression asynchronously (fire and forget)
        const API_URL = (globalThis as any).ROSMARIUM_API_URL || "http://localhost:3001";
        fetch(`${API_URL}/api/personalization/variants/${matchingVariant.id}/impression`, { method: 'POST' }).catch(() => {});

        // Apply overrides
        return {
            ...entry,
            ...matchingVariant.overrides,
            _personalized: true,
            _variantId: matchingVariant.id,
        };
    }

    return entry;
};
