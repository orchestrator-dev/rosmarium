import { sql, inArray } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { contentEntries } from "../../../db/schema/index.js";
import type { TraversalNode, TraversalEdge } from "./traversal.engine.js";

export interface PathResult {
  path: TraversalNode[];
  edges: TraversalEdge[];
  hopCount: number;
  found: boolean;
}

export async function findShortestPath(
  fromEntryId: string,
  toEntryId: string,
  opts?: {
    edgeTypes?: string[];
    maxDepth?: number; // default 5
  }
): Promise<PathResult> {
  const maxDepth = Math.min(opts?.maxDepth ?? 5, 5);
  const edgeTypes = opts?.edgeTypes && opts.edgeTypes.length > 0 ? opts.edgeTypes : null;

  if (fromEntryId === toEntryId) {
    return { found: false, path: [], edges: [], hopCount: 0 };
  }

  const query = sql`
    WITH RECURSIVE path_search AS (
      SELECT
        ge.from_entry_id,
        ge.to_entry_id,
        ge.from_content_type,
        ge.to_content_type,
        ge.edge_type,
        ge.weight,
        ge.id AS edge_id,
        1 AS depth,
        ARRAY[ge.from_entry_id, ge.to_entry_id] AS path,
        ARRAY[ge.id] AS edge_path,
        (ge.to_entry_id = ${toEntryId}) AS found
      FROM graph_edges ge
      WHERE ge.from_entry_id = ${fromEntryId}
        AND ge.is_accepted = 'accepted'
        AND (${edgeTypes === null} OR ge.edge_type = ANY(${edgeTypes}::text[]))

      UNION ALL

      SELECT
        ge.from_entry_id,
        ge.to_entry_id,
        ge.from_content_type,
        ge.to_content_type,
        ge.edge_type,
        ge.weight,
        ge.id AS edge_id,
        ps.depth + 1,
        ps.path || ge.to_entry_id,
        ps.edge_path || ge.id,
        (ge.to_entry_id = ${toEntryId}) AS found
      FROM graph_edges ge
      JOIN path_search ps ON ps.to_entry_id = ge.from_entry_id
      WHERE ps.depth < ${maxDepth}
        AND NOT (ge.to_entry_id = ANY(ps.path))
        AND ge.is_accepted = 'accepted'
        AND (${edgeTypes === null} OR ge.edge_type = ANY(${edgeTypes}::text[]))
        AND NOT ps.found
    )
    SELECT * FROM path_search WHERE found = true
    ORDER BY depth ASC LIMIT 1
  `;

  const dbResult = await db.execute(query);
  const rows = (Array.isArray(dbResult) ? dbResult : (dbResult as Record<string, unknown>).rows) as { path: string[], edge_path: string[], depth: number }[];

  if (rows.length === 0) {
    return { found: false, path: [], edges: [], hopCount: 0 };
  }

  const resultRow = rows[0]!;
  const nodeIds: string[] = resultRow.path;
  const edgeIds: string[] = resultRow.edge_path;

  // Retrieve nodes and edges info to build the response
  const entries = await db.select().from(contentEntries).where(inArray(contentEntries.id, nodeIds));
  const entriesMap = new Map(entries.map((e) => [e.id, { contentType: e.contentTypeId, data: e.data }]));

  const path: TraversalNode[] = nodeIds.map((id, index) => ({
    entryId: id,
    contentType: entriesMap.get(id)?.contentType || "",
    depth: index,
    data: entriesMap.get(id)?.data as Record<string, unknown>,
  }));

  // Fetch edge details
  // Wait, dbResult.rows doesn't have all the edges, just edge_path array of IDs. Let's fetch them from graph_edges
  const { graphEdges } = await import("../../../db/schema/index.js");
  const edgeRecords = await db.select().from(graphEdges).where(inArray(graphEdges.id, edgeIds));
  const edgesMap = new Map(edgeRecords.map((e) => [e.id, e]));

  const edges: TraversalEdge[] = edgeIds.map((id, index) => {
    const e = edgesMap.get(id);
    return {
      id: id,
      fromEntryId: e!.fromEntryId,
      toEntryId: e!.toEntryId,
      edgeType: e!.edgeType,
      weight: e!.weight,
      depth: index + 1,
    };
  });

  return {
    found: true,
    path,
    edges,
    hopCount: resultRow.depth,
  };
}
