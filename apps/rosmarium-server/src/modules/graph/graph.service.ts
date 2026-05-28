/**
 * Graph service — validation layer over graph.repository.
 * Enforces allowed edge types from content type settings.
 */

import { registry } from "../content/registry.js";
import { parseGraphSettings } from "./graph-settings.js";
import {
    graphRepository,
    type CreateEdgeInput,
    type GetEdgesInput,
} from "./graph.repository.js";
import type {
    GraphEdge,
    GraphEntityNode,
    EntryEntityMention,
} from "../../db/schema/index.js";

// ─── Errors ───────────────────────────────────────────────────────────────────

export class GraphValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "GraphValidationError";
    }
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const graphService = {
    /**
     * Create a typed edge between two content entries.
     * Validates the edgeType against allowedEdgeTypes in the source content type's
     * graph settings. Automatically sets `bidirectional` flag from settings.
     *
     * Edges from auto-inference sources (auto_ner, auto_similarity, auto_reference)
     * skip allowedEdgeTypes validation — the inference pipeline is trusted.
     */
    async createEdge(
        input: CreateEdgeInput & { createdBy?: string | null },
    ): Promise<GraphEdge> {
        const isAutoSource =
            input.source !== undefined && input.source !== "manual" && input.source !== "api";

        if (!isAutoSource) {
            const contentType = registry.get(input.fromContentType);
            if (!contentType) {
                throw new GraphValidationError(
                    `Unknown content type: '${input.fromContentType}'`,
                );
            }

            const graphSettings = parseGraphSettings(contentType.settings);

            if (!graphSettings.enabled) {
                throw new GraphValidationError(
                    `Graph is not enabled for content type '${input.fromContentType}'`,
                );
            }

            const allowed = graphSettings.allowedEdgeTypes.find(
                (et) => et.edgeType === input.edgeType,
            );

            if (!allowed) {
                throw new GraphValidationError(
                    `Edge type '${input.edgeType}' is not allowed for content type '${input.fromContentType}'`,
                );
            }

            if (
                allowed.targetContentTypes.length > 0 &&
                !allowed.targetContentTypes.includes(input.toContentType)
            ) {
                throw new GraphValidationError(
                    `Edge type '${input.edgeType}' cannot target content type '${input.toContentType}'`,
                );
            }

            // Propagate bidirectional flag from settings
            return graphRepository.createEdge({
                ...input,
                bidirectional: input.bidirectional ?? allowed.bidirectional,
            });
        }

        return graphRepository.createEdge(input);
    },

    /** Delete an edge by ID. */
    async deleteEdge(id: string): Promise<void> {
        return graphRepository.deleteEdge(id);
    },

    /** Get edges for an entry. */
    async getEdgesForEntry(opts: GetEdgesInput): Promise<GraphEdge[]> {
        return graphRepository.getEdgesForEntry(opts);
    },

    /** Accept a pending edge. */
    async acceptEdge(id: string): Promise<GraphEdge | undefined> {
        return graphRepository.acceptEdge(id);
    },

    /** Reject a pending edge. */
    async rejectEdge(id: string): Promise<GraphEdge | undefined> {
        return graphRepository.rejectEdge(id);
    },

    /** Get all pending edges across all content types. */
    async getPendingEdges(limit = 50): Promise<GraphEdge[]> {
        return graphRepository.getPendingEdges(limit);
    },

    /** Get entity nodes, optionally filtered by type. */
    async getEntityNodes(opts: {
        entityType?: string;
        limit?: number;
    }): Promise<GraphEntityNode[]> {
        return graphRepository.getEntityNodes(opts);
    },

    /** Get entity mentions for a specific entry. */
    async getEntityMentions(
        entryId: string,
    ): Promise<(EntryEntityMention & { entity: GraphEntityNode })[]> {
        return graphRepository.getEntityMentions(entryId);
    },
};
