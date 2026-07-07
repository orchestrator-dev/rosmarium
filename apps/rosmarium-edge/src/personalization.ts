/* eslint-disable @typescript-eslint/no-explicit-any */
import { extractTraits } from "./traits.js";
import { variantCache } from "./variant-cache.js";

function getTraitValue(trait: string, traits: Record<string, any>): any {
    if (trait in traits) {
        return traits[trait];
    }
    const parts = trait.split(".");
    let current: any = traits;
    for (const part of parts) {
        if (current && typeof current === "object" && part in current) {
            current = current[part];
        } else {
            return undefined;
        }
    }
    return current;
}

// Evaluates a condition against user traits
const evaluateCondition = (condition: any, traits: any): boolean => {
    const value = getTraitValue(condition.trait, traits);
    if (value === undefined || value === null) {
        return false;
    }

    const condVal = condition.value;
    switch (condition.operator) {
        case "eq":
            return typeof value === "string" && typeof condVal === "string"
                ? value.toLowerCase() === condVal.toLowerCase()
                : value === condVal;
        case "neq":
            return typeof value === "string" && typeof condVal === "string"
                ? value.toLowerCase() !== condVal.toLowerCase()
                : value !== condVal;
        case "in":
            if (Array.isArray(condVal)) return condVal.includes(value);
            if (typeof condVal === "string") {
                return condVal.split(",").map((s) => s.trim().toLowerCase()).includes(String(value).toLowerCase());
            }
            return false;
        case "gt":
            return Number(value) > Number(condVal);
        case "lt":
            return Number(value) < Number(condVal);
        case "contains":
            return String(value).toLowerCase().includes(String(condVal).toLowerCase());
        case "regex":
            try {
                return new RegExp(String(condVal), "i").test(String(value));
            } catch {
                return false;
            }
        default:
            return false;
    }
};

// Evaluate segments and return sorted by priority descending
const evaluateSegments = async (traits: any, segments: any[]): Promise<any[]> => {
    const matchedSegments: any[] = [];

    for (const segment of segments) {
        let isMatch = false;
        if (!segment.conditions || segment.conditions.length === 0) {
            isMatch = true;
        } else if (segment.logic === "or") {
            isMatch = segment.conditions.some((c: any) => evaluateCondition(c, traits));
        } else {
            isMatch = segment.conditions.every((c: any) => evaluateCondition(c, traits));
        }

        if (isMatch) {
            matchedSegments.push(segment);
        }
    }

    return matchedSegments.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
};

export const getSegmentsFromKV = async (kv: any, originUrl: string): Promise<any[]> => {
    if (kv) {
        const cached = await kv.get("personalization:segments", "json");
        if (cached && Array.isArray(cached)) return cached;
    }

    try {
        const res = await fetch(`${originUrl}/api/personalization/segments`);
        if (res.ok) {
            const segments = await res.json();
            if (kv && Array.isArray(segments)) {
                await kv.put("personalization:segments", JSON.stringify(segments), { expirationTtl: 300 });
            }
            return Array.isArray(segments) ? segments : [];
        }
    } catch {
        // Fallback on origin error
    }
    return [];
};

export const applyPersonalization = async (
    request: Request,
    entry: any,
    segments: any[],
    options?: { abTestRatio?: number; kv?: any; originUrl?: string }
) => {
    const traits = extractTraits(request);
    const matchedSegments = await evaluateSegments(traits, segments);

    if (matchedSegments.length === 0) {
        return { content: entry, isPersonalized: false };
    }

    const bestSegment = matchedSegments[0];
    const variants = await variantCache.getVariantsForEntry(entry.id, options?.kv, options?.originUrl);
    const matchingVariant = variants.find((v) => v.segmentId === bestSegment.id);


    if (matchingVariant) {
        // Deterministic A/B test check if abTestRatio is set
        const ratio = options?.abTestRatio ?? 0.5;
        const identifier = String(traits.userId || traits.userSegment || traits.country || "anonymous");
        let hash = 0;
        for (let i = 0; i < identifier.length; i++) {
            hash = (hash << 5) - hash + identifier.charCodeAt(i);
            hash |= 0;
        }
        const normalizedHash = Math.abs(hash % 100) / 100.0;

        // If in A/B test mode and user falls outside variant ratio, serve base content with A/B flag
        if (options?.abTestRatio !== undefined && normalizedHash >= ratio) {
            return {
                content: {
                    ...entry,
                    _abTest: true,
                    _segmentId: bestSegment.id,
                },
                isPersonalized: true,
                segmentId: bestSegment.id,
                isABTest: true,
            };
        }

        // Record impression asynchronously (fire and forget)
        const API_URL = (globalThis as any).ROSMARIUM_API_URL || "http://localhost:3001";
        fetch(`${API_URL}/api/personalization/variants/${matchingVariant.id}/impression`, { method: "POST" }).catch(() => {});

        // Apply overrides
        return {
            content: {
                ...entry,
                ...matchingVariant.overrides,
                _personalized: true,
                _variantId: matchingVariant.id,
                _segmentId: bestSegment.id,
            },
            isPersonalized: true,
            variantId: matchingVariant.id,
            segmentId: bestSegment.id,
        };
    }

    return { content: entry, isPersonalized: false };
};

