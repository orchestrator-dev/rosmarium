/**
 * Graph repository — all Drizzle ORM queries for graph_edges,
 * graph_entity_nodes, and entry_entity_mentions.
 */

import { and, eq, gte, or, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
    graphEdges,
    graphEntityNodes,
    entryEntityMentions,
    type GraphEdge,
    type GraphEntityNode,
    type EntryEntityMention,
} from "../../db/schema/index.js";

// ─── Input types ──────────────────────────────────────────────────────────────

export interface CreateEdgeInput {
    fromEntryId: string;
    fromContentType: string;
    toEntryId: string;
    toContentType: string;
    edgeType: string;
    weight?: number;
    properties?: Record<string, unknown>;
    source?: "manual" | "auto_ner" | "auto_similarity" | "auto_reference" | "api";
    isAccepted?: "pending" | "accepted" | "rejected";
    createdBy?: string | null;
    /** When true, also insert the reverse B→A edge in the same transaction. */
    bidirectional?: boolean;
}

export interface GetEdgesInput {
    entryId: string;
    direction?: "outbound" | "inbound" | "both";
    edgeType?: string;
    minWeight?: number;
    status?: "pending" | "accepted" | "rejected" | "all";
    limit?: number;
}

export interface UpsertEntityInput {
    entityText: string;
    entityType: string;
    metadata?: Record<string, unknown>;
}

// ─── Repository ───────────────────────────────────────────────────────────────

export const graphRepository = {
    // ── Edges ───────────────────────────────────────────────────────────────

    /**
     * Create a new edge. If an edge with the same (from, to, type) already exists
     * it returns the existing row without updating it.
     * If `bidirectional` is true, also creates the reverse edge in the same transaction.
     */
    async createEdge(input: CreateEdgeInput): Promise<GraphEdge> {
        const edgeData = {
            fromEntryId: input.fromEntryId,
            fromContentType: input.fromContentType,
            toEntryId: input.toEntryId,
            toContentType: input.toContentType,
            edgeType: input.edgeType,
            weight: input.weight ?? 1.0,
            properties: input.properties ?? {},
            source: input.source ?? "manual",
            isAccepted: input.isAccepted ?? "accepted",
            createdBy: input.createdBy ?? null,
        };

        const [edge] = await db.transaction(async (tx) => {
            const [forward] = await tx
                .insert(graphEdges)
                .values(edgeData)
                .onConflictDoUpdate({
                    target: [
                        graphEdges.fromEntryId,
                        graphEdges.toEntryId,
                        graphEdges.edgeType,
                    ],
                    set: { updatedAt: new Date() },
                })
                .returning();

            if (input.bidirectional) {
                await tx
                    .insert(graphEdges)
                    .values({
                        ...edgeData,
                        fromEntryId: input.toEntryId,
                        fromContentType: input.toContentType,
                        toEntryId: input.fromEntryId,
                        toContentType: input.fromContentType,
                    })
                    .onConflictDoUpdate({
                        target: [
                            graphEdges.fromEntryId,
                            graphEdges.toEntryId,
                            graphEdges.edgeType,
                        ],
                        set: { updatedAt: new Date() },
                    });
            }

            return [forward!];
        });

        return edge;
    },

    /** Delete an edge by ID. */
    async deleteEdge(id: string): Promise<void> {
        await db.delete(graphEdges).where(eq(graphEdges.id, id));
    },

    /** Fetch edges for an entry, with optional filtering. */
    async getEdgesForEntry(opts: GetEdgesInput): Promise<GraphEdge[]> {
        const {
            entryId,
            direction = "both",
            edgeType,
            minWeight,
            status = "all",
            limit = 50,
        } = opts;

        const conditions = [];

        if (direction === "outbound") {
            conditions.push(eq(graphEdges.fromEntryId, entryId));
        } else if (direction === "inbound") {
            conditions.push(eq(graphEdges.toEntryId, entryId));
        } else {
            conditions.push(
                or(
                    eq(graphEdges.fromEntryId, entryId),
                    eq(graphEdges.toEntryId, entryId),
                )!,
            );
        }

        if (edgeType) {
            conditions.push(eq(graphEdges.edgeType, edgeType));
        }

        if (minWeight !== undefined) {
            conditions.push(gte(graphEdges.weight, minWeight));
        }

        if (status !== "all") {
            conditions.push(eq(graphEdges.isAccepted, status));
        }

        return db
            .select()
            .from(graphEdges)
            .where(and(...conditions))
            .limit(limit)
            .orderBy(graphEdges.weight);
    },

    /** Accept a pending edge. */
    async acceptEdge(id: string): Promise<GraphEdge | undefined> {
        const [row] = await db
            .update(graphEdges)
            .set({ isAccepted: "accepted", updatedAt: new Date() })
            .where(eq(graphEdges.id, id))
            .returning();
        return row;
    },

    /** Reject a pending edge. */
    async rejectEdge(id: string): Promise<GraphEdge | undefined> {
        const [row] = await db
            .update(graphEdges)
            .set({ isAccepted: "rejected", updatedAt: new Date() })
            .where(eq(graphEdges.id, id))
            .returning();
        return row;
    },

    /** Get all pending edges (for human review). */
    async getPendingEdges(limit = 50): Promise<GraphEdge[]> {
        return db
            .select()
            .from(graphEdges)
            .where(eq(graphEdges.isAccepted, "pending"))
            .limit(limit)
            .orderBy(graphEdges.createdAt);
    },

    // ── Entity nodes ─────────────────────────────────────────────────────────

    /**
     * Upsert an entity node. On conflict (canonical_text, entity_type),
     * increment mention_count.
     */
    async upsertEntityNode(input: UpsertEntityInput): Promise<GraphEntityNode> {
        const canonicalText = input.entityText.toLowerCase().trim();
        const [row] = await db
            .insert(graphEntityNodes)
            .values({
                entityText: input.entityText,
                canonicalText,
                entityType: input.entityType,
                metadata: input.metadata ?? {},
            })
            .onConflictDoUpdate({
                target: [
                    graphEntityNodes.canonicalText,
                    graphEntityNodes.entityType,
                ],
                set: {
                    mentionCount: sql`${graphEntityNodes.mentionCount} + 1`,
                    updatedAt: new Date(),
                },
            })
            .returning();
        return row!;
    },

    /** List entity nodes, optionally filtered by type. */
    async getEntityNodes(opts: {
        entityType?: string;
        limit?: number;
    }): Promise<GraphEntityNode[]> {
        const { entityType, limit = 100 } = opts;
        const conditions = entityType
            ? [eq(graphEntityNodes.entityType, entityType)]
            : [];

        return db
            .select()
            .from(graphEntityNodes)
            .where(conditions.length ? and(...conditions) : undefined)
            .limit(limit)
            .orderBy(graphEntityNodes.mentionCount);
    },

    // ── Entry → entity mentions ───────────────────────────────────────────────

    /**
     * Upsert a mention link between an entry and an entity node.
     * Idempotent — silently ignores duplicate (entry_id, entity_id) pairs.
     */
    async upsertEntryEntityMention(
        entryId: string,
        entityId: string,
        confidence = 1.0,
    ): Promise<void> {
        await db
            .insert(entryEntityMentions)
            .values({ entryId, entityId, confidence })
            .onConflictDoNothing();
    },

    /** Get all entity mentions for an entry, including entity node data. */
    async getEntityMentions(
        entryId: string,
    ): Promise<(EntryEntityMention & { entity: GraphEntityNode })[]> {
        const rows = await db
            .select({
                mention: entryEntityMentions,
                entity: graphEntityNodes,
            })
            .from(entryEntityMentions)
            .innerJoin(
                graphEntityNodes,
                eq(entryEntityMentions.entityId, graphEntityNodes.id),
            )
            .where(eq(entryEntityMentions.entryId, entryId));

        return rows.map((r) => ({ ...r.mention, entity: r.entity }));
    },
};
