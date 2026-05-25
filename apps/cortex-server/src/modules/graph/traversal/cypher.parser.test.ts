import { parseCypher } from "./cypher.parser.js";
import { describe, it, expect } from "vitest";

describe("Cypher Parser", () => {
    it("should parse a basic match query", () => {
        const query = "MATCH (n {id: '123'})-[r:RELATED_TO]->(b) RETURN b";
        const result = parseCypher(query);

        expect(result.ast.match.startNode).toBe("n");
        expect(result.ast.match.startId).toBe("123");
        expect(result.ast.match.relationships[0].targetNode).toBe("b");
        expect(result.ast.match.relationships[0].relName).toBe("r");
        expect(result.ast.match.relationships[0].edgeType).toBe("RELATED_TO");
        expect(result.ast.match.relationships[0].minDepth).toBe(1);
        expect(result.ast.match.relationships[0].maxDepth).toBe(1);
        expect(result.ast.returns).toEqual(["b"]);
    });

    it("should parse hop limits", () => {
        const query = "MATCH (n {id: 'abc'})-[rel:TAGGED*1..3]->(m) RETURN m";
        const result = parseCypher(query);

        expect(result.ast.match.relationships[0].minDepth).toBe(1);
        expect(result.ast.match.relationships[0].maxDepth).toBe(3);
    });

    it("should fail on invalid syntax", () => {
        const query = "MATCH a TO b";
        expect(() => parseCypher(query)).toThrow("MATCH clause must start with a node specifying an id");
    });
});
