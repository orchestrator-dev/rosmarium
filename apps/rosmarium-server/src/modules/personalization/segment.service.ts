import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { segments } from "../../db/schema/personalization.js";
import { AudienceSegment, SegmentCondition, TraitContext } from "@orchestrator.dev/types";

function getTraitValue(trait: string, context: TraitContext): unknown {
    if (trait in context) {
        return context[trait];
    }
    const parts = trait.split(".");
    let current: unknown = context;
    for (const part of parts) {
        if (current && typeof current === "object" && part in (current as Record<string, unknown>)) {
            current = (current as Record<string, unknown>)[part];
        } else {
            return undefined;
        }
    }
    return current;
}

export function evaluateCondition(condition: SegmentCondition, context: TraitContext): boolean {
    const value = getTraitValue(condition.trait, context);
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
            if (Array.isArray(condVal)) {
                return condVal.includes(value);
            }
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
}

export function evaluateSegment(segment: AudienceSegment, context: TraitContext): boolean {
    if (!segment.conditions || segment.conditions.length === 0) {
        return true;
    }
    if (segment.logic === "or") {
        return segment.conditions.some((c) => evaluateCondition(c, context));
    }
    return segment.conditions.every((c) => evaluateCondition(c, context));
}

export const segmentService = {
    async createSegment(data: Omit<AudienceSegment, "id">) {
        const [result] = await db
            .insert(segments)
            .values({
                name: data.name,
                description: data.description,
                conditions: data.conditions as unknown as Record<string, unknown>,
                logic: data.logic,
                priority: data.priority,
            })
            .returning();
        return result as unknown as AudienceSegment;
    },

    async getSegments(): Promise<AudienceSegment[]> {
        const results = await db.select().from(segments).orderBy(segments.priority);
        return results as unknown as AudienceSegment[];
    },

    async getSegmentById(id: string): Promise<AudienceSegment | null> {
        const [result] = await db.select().from(segments).where(eq(segments.id, id)).limit(1);
        return (result as unknown as AudienceSegment) || null;
    },

    async updateSegment(id: string, data: Partial<AudienceSegment>): Promise<AudienceSegment | null> {
        const [result] = await db
            .update(segments)
            .set({
                ...data,
                conditions: data.conditions as unknown as Record<string, unknown>,
                updatedAt: new Date(),
            })
            .where(eq(segments.id, id))
            .returning();
        return (result as unknown as AudienceSegment) || null;
    },

    async deleteSegment(id: string): Promise<AudienceSegment | null> {
        const [result] = await db.delete(segments).where(eq(segments.id, id)).returning();
        return (result as unknown as AudienceSegment) || null;
    },

    async evaluateAudience(context: TraitContext): Promise<AudienceSegment | null> {
        const allSegments = await this.getSegments();
        // Sort descending by priority (higher number = evaluated first)
        const sorted = [...allSegments].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
        for (const segment of sorted) {
            if (evaluateSegment(segment, context)) {
                return segment;
            }
        }
        return null;
    },

    async getMatchingSegments(context: TraitContext): Promise<AudienceSegment[]> {
        const allSegments = await this.getSegments();
        const sorted = [...allSegments].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
        return sorted.filter((segment) => evaluateSegment(segment, context));
    },
};

