/**
 * Zod schema for the `graph` settings block inside a content type's settings JSONB.
 * Validate with: contentTypeGraphSettingsSchema.parse(contentType.settings.graph ?? {})
 */

import { z } from "zod";

// ─── Allowed edge type definition ─────────────────────────────────────────────

export const allowedEdgeTypeSchema = z.object({
    /** Internal edge type key, e.g. "relatedTo", "mentions", "references" */
    edgeType: z.string().min(1),
    /** Human-readable label for the UI */
    label: z.string().min(1),
    /** Content types that can be the target of this edge (empty = any) */
    targetContentTypes: z.array(z.string()).default([]),
    /** If true, creating A→B also creates B→A with the same type */
    bidirectional: z.boolean().default(false),
    /**
     * Maximum outbound edges of this type per entry.
     * null = unlimited.
     */
    maxOutbound: z.number().int().positive().nullable().default(null),
});

export type AllowedEdgeType = z.infer<typeof allowedEdgeTypeSchema>;

// ─── Top-level graph settings ─────────────────────────────────────────────────

export const contentTypeGraphSettingsSchema = z.object({
    /** Whether graph features are enabled for this content type */
    enabled: z.boolean().default(false),
    /** Edge types this content type may participate in as the source */
    allowedEdgeTypes: z.array(allowedEdgeTypeSchema).default([]),
    /**
     * Auto-inference strategies to run after intelligence jobs.
     * "ner"        — entity co-mention edges from NER results
     * "similarity" — embedding cosine-similarity edges
     * "references" — slug/id reference extraction edges
     */
    inferenceStrategies: z
        .array(z.enum(["ner", "similarity", "references"]))
        .default(["ner", "similarity"]),
    /** Minimum cosine similarity (0–1) to create a similarity edge */
    similarityThreshold: z.number().min(0).max(1).default(0.85),
    /** Maximum number of similarity edges to create per entry */
    maxSimilarityEdges: z.number().int().positive().default(5),
});

export type ContentTypeGraphSettings = z.infer<
    typeof contentTypeGraphSettingsSchema
>;

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Parse graph settings from a raw settings object.
 * Returns a valid default if the `graph` key is absent or invalid.
 */
export function parseGraphSettings(
    settings: Record<string, unknown>,
): ContentTypeGraphSettings {
    const raw = settings["graph"] ?? {};
    const result = contentTypeGraphSettingsSchema.safeParse(raw);
    if (result.success) return result.data;
    return contentTypeGraphSettingsSchema.parse({});
}
