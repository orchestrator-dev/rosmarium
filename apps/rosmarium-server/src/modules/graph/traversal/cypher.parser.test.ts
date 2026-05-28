import { describe, it, expect, vi } from "vitest";

// ─── cypher.parser imports drizzle db which chains to config.ts at module load.
// Mock both before importing the parser. ─────────────────────────────────────
vi.mock("../../../config.js", () => ({
    config: {
        DATABASE_URL: "postgresql://test:test@localhost:5432/test",
        REDIS_URL: "redis://localhost:6379",
    },
}));

vi.mock("../../../db/index.js", () => ({
    db: {
        execute: vi.fn(),
        select: vi.fn(),
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        transaction: vi.fn(),
    },
}));

import { parseCypher } from "./cypher.parser.js";

describe("parseCypher", () => {
    it("parses a basic single-hop match query", () => {
        const query = "MATCH (n {id: '123'})-[r:RELATED_TO]->(b) RETURN b";
        const result = parseCypher(query);

        expect(result.ast.match.startNode).toBe("n");
        expect(result.ast.match.startId).toBe("123");
        expect(result.ast.match.relationships[0]?.targetNode).toBe("b");
        expect(result.ast.match.relationships[0]?.relName).toBe("r");
        expect(result.ast.match.relationships[0]?.edgeType).toBe("RELATED_TO");
        expect(result.ast.match.relationships[0]?.minDepth).toBe(1);
        expect(result.ast.match.relationships[0]?.maxDepth).toBe(1);
        expect(result.ast.returns).toEqual(["b"]);
    });

    it("parses variable-length hop limits [*1..3]", () => {
        const query = "MATCH (n {id: 'abc'})-[rel:TAGGED*1..3]->(m) RETURN m";
        const result = parseCypher(query);

        expect(result.ast.match.relationships[0]?.minDepth).toBe(1);
        expect(result.ast.match.relationships[0]?.maxDepth).toBe(3);
    });

    it("defaults min/max depth to 1 when no hop range specified", () => {
        const query = "MATCH (n {id: 'xyz'})-[r:LINKS]->(m) RETURN m";
        const result = parseCypher(query);

        expect(result.ast.match.relationships[0]?.minDepth).toBe(1);
        expect(result.ast.match.relationships[0]?.maxDepth).toBe(1);
    });

    it("returns the correct node alias in the returns list", () => {
        const query = "MATCH (n {id: 'x'})-[r:TAGGED]->(m) RETURN m";
        const result = parseCypher(query);

        expect(result.ast.returns).toContain("m");
    });

    it("throws CypherParseError on invalid syntax (no id predicate)", () => {
        expect(() => parseCypher("MATCH a TO b")).toThrow(
            "MATCH clause must start with a node specifying an id",
        );
    });

    it("throws CypherParseError when RETURN clause is missing", () => {
        expect(() => parseCypher("MATCH (n {id: 'x'})-[r:TAGGED]->(m)")).toThrow();
    });
});
