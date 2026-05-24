/**
 * Unit tests for graph.service — mocks the repository to avoid DB dependency.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { GraphValidationError } from "./graph.service.js";

// ── Mock the repository ────────────────────────────────────────────────────────

vi.mock("./graph.repository.js", () => ({
    graphRepository: {
        createEdge: vi.fn(),
        deleteEdge: vi.fn(),
        getEdgesForEntry: vi.fn(),
        acceptEdge: vi.fn(),
        rejectEdge: vi.fn(),
        getPendingEdges: vi.fn(),
        upsertEntityNode: vi.fn(),
        upsertEntryEntityMention: vi.fn(),
        getEntityNodes: vi.fn(),
        getEntityMentions: vi.fn(),
    },
}));

// ── Mock the registry ──────────────────────────────────────────────────────────

vi.mock("../content/registry.js", () => ({
    registry: {
        get: vi.fn(),
    },
}));

import { graphRepository } from "./graph.repository.js";
import { registry } from "../content/registry.js";
import { graphService } from "./graph.service.js";

const mockRepo = graphRepository as Record<string, ReturnType<typeof vi.fn>>;
const mockRegistry = registry as { get: ReturnType<typeof vi.fn> };

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeContentType(graphSettings: Record<string, unknown>) {
    return {
        id: "ct1",
        name: "article",
        displayName: "Article",
        description: null,
        fields: [],
        settings: { graph: graphSettings },
        isSystem: false,
        archivedAt: null,
        createdBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
    };
}

function makeEdge(overrides?: Record<string, unknown>) {
    return {
        id: "edge1",
        fromEntryId: "entry-a",
        fromContentType: "article",
        toEntryId: "entry-b",
        toContentType: "article",
        edgeType: "relatedTo",
        weight: 1.0,
        properties: {},
        source: "manual" as const,
        isAccepted: "accepted" as const,
        createdBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
    };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("graphService.createEdge", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("throws GraphValidationError for unknown content type", async () => {
        mockRegistry.get.mockReturnValue(undefined);

        await expect(
            graphService.createEdge({
                fromEntryId: "a",
                fromContentType: "unknown",
                toEntryId: "b",
                toContentType: "article",
                edgeType: "relatedTo",
                source: "manual",
            }),
        ).rejects.toThrow(GraphValidationError);
    });

    it("throws GraphValidationError when graph is not enabled", async () => {
        mockRegistry.get.mockReturnValue(
            makeContentType({ enabled: false, allowedEdgeTypes: [] }),
        );

        await expect(
            graphService.createEdge({
                fromEntryId: "a",
                fromContentType: "article",
                toEntryId: "b",
                toContentType: "article",
                edgeType: "relatedTo",
                source: "manual",
            }),
        ).rejects.toThrow(GraphValidationError);
    });

    it("throws GraphValidationError for disallowed edge type", async () => {
        mockRegistry.get.mockReturnValue(
            makeContentType({
                enabled: true,
                allowedEdgeTypes: [
                    { edgeType: "mentions", label: "Mentions", targetContentTypes: [], bidirectional: false },
                ],
            }),
        );

        await expect(
            graphService.createEdge({
                fromEntryId: "a",
                fromContentType: "article",
                toEntryId: "b",
                toContentType: "article",
                edgeType: "relatedTo", // not in allowedEdgeTypes
                source: "manual",
            }),
        ).rejects.toThrow(GraphValidationError);
    });

    it("creates edge when type is allowed", async () => {
        const edge = makeEdge();
        mockRepo.createEdge.mockResolvedValue(edge);
        mockRegistry.get.mockReturnValue(
            makeContentType({
                enabled: true,
                allowedEdgeTypes: [
                    {
                        edgeType: "relatedTo",
                        label: "Related To",
                        targetContentTypes: [],
                        bidirectional: true,
                    },
                ],
            }),
        );

        const result = await graphService.createEdge({
            fromEntryId: "a",
            fromContentType: "article",
            toEntryId: "b",
            toContentType: "article",
            edgeType: "relatedTo",
            source: "manual",
        });

        expect(result).toEqual(edge);
        expect(mockRepo.createEdge).toHaveBeenCalledWith(
            expect.objectContaining({ bidirectional: true }),
        );
    });

    it("skips allowedEdgeTypes check for auto_ner source", async () => {
        const edge = makeEdge({ source: "auto_ner", isAccepted: "pending" });
        mockRepo.createEdge.mockResolvedValue(edge);
        // Registry.get should NOT be called for auto sources
        mockRegistry.get.mockReturnValue(undefined);

        const result = await graphService.createEdge({
            fromEntryId: "a",
            fromContentType: "article",
            toEntryId: "b",
            toContentType: "person",
            edgeType: "mentions",
            source: "auto_ner",
        });

        expect(result).toEqual(edge);
        expect(mockRegistry.get).not.toHaveBeenCalled();
    });

    it("throws GraphValidationError when target content type is not allowed", async () => {
        mockRegistry.get.mockReturnValue(
            makeContentType({
                enabled: true,
                allowedEdgeTypes: [
                    {
                        edgeType: "references",
                        label: "References",
                        targetContentTypes: ["document"],
                        bidirectional: false,
                    },
                ],
            }),
        );

        await expect(
            graphService.createEdge({
                fromEntryId: "a",
                fromContentType: "article",
                toEntryId: "b",
                toContentType: "video", // not in targetContentTypes
                edgeType: "references",
                source: "manual",
            }),
        ).rejects.toThrow(GraphValidationError);
    });
});

describe("graphService.acceptEdge / rejectEdge", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns the updated edge on accept", async () => {
        const edge = makeEdge({ isAccepted: "accepted" });
        mockRepo.acceptEdge.mockResolvedValue(edge);

        const result = await graphService.acceptEdge("edge1");
        expect(result).toEqual(edge);
        expect(mockRepo.acceptEdge).toHaveBeenCalledWith("edge1");
    });

    it("returns the updated edge on reject", async () => {
        const edge = makeEdge({ isAccepted: "rejected" });
        mockRepo.rejectEdge.mockResolvedValue(edge);

        const result = await graphService.rejectEdge("edge1");
        expect(result).toEqual(edge);
        expect(mockRepo.rejectEdge).toHaveBeenCalledWith("edge1");
    });

    it("returns undefined when edge not found", async () => {
        mockRepo.acceptEdge.mockResolvedValue(undefined);
        const result = await graphService.acceptEdge("nonexistent");
        expect(result).toBeUndefined();
    });
});

describe("graphService.getPendingEdges", () => {
    it("delegates to repository with default limit", async () => {
        mockRepo.getPendingEdges.mockResolvedValue([]);
        await graphService.getPendingEdges();
        expect(mockRepo.getPendingEdges).toHaveBeenCalledWith(50);
    });
});
