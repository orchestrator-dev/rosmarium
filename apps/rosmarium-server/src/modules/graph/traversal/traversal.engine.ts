import { sql, inArray } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { contentEntries } from "../../../db/schema/index.js";

export interface TraversalOptions {
  fromEntryId: string;
  direction: "outbound" | "inbound" | "both";
  edgeTypes?: string[];
  maxDepth: number; // default 2, max 5
  minWeight?: number; // default 0
  limit?: number; // default 50
  includeData?: boolean;
}

export interface TraversalNode {
  entryId: string;
  contentType: string;
  depth: number;
  data?: Record<string, unknown>;
}

export interface TraversalEdge {
  id: string;
  fromEntryId: string;
  toEntryId: string;
  edgeType: string;
  weight: number;
  depth: number;
}

export interface TraversalResult {
  nodes: TraversalNode[];
  edges: TraversalEdge[];
  rootEntryId: string;
  maxDepth: number;
  totalNodes: number;
  latencyMs: number;
}

export async function traverse(
  opts: TraversalOptions
): Promise<TraversalResult> {
  const start = performance.now();
  const maxDepth = Math.min(opts.maxDepth ?? 2, 5);
  const limit = Math.min(opts.limit ?? 50, 200);
  const minWeight = opts.minWeight ?? 0;
  const edgeTypes = opts.edgeTypes && opts.edgeTypes.length > 0 ? opts.edgeTypes : null;

  const buildBaseCase = (dir: "outbound" | "inbound") => {
    const fromCol = dir === "outbound" ? "from_entry_id" : "to_entry_id";
    return sql`
      SELECT
        ge.from_entry_id,
        ge.to_entry_id,
        ge.from_content_type,
        ge.to_content_type,
        ge.edge_type,
        ge.weight,
        ge.id AS edge_id,
        1 AS depth,
        ARRAY[ge.${sql.raw(fromCol)}] AS visited
      FROM graph_edges ge
      WHERE ge.${sql.raw(fromCol)} = ${opts.fromEntryId}
        AND ge.is_accepted = 'accepted'
        AND (${edgeTypes === null} OR ge.edge_type = ANY(${edgeTypes}::text[]))
        AND ge.weight >= ${minWeight}
    `;
  };

  const buildRecursiveCase = (dir: "outbound" | "inbound", cteName: string) => {
    const fromCol = dir === "outbound" ? "from_entry_id" : "to_entry_id";
    const toCol = dir === "outbound" ? "to_entry_id" : "from_entry_id";
    return sql`
      SELECT
        ge.from_entry_id,
        ge.to_entry_id,
        ge.from_content_type,
        ge.to_content_type,
        ge.edge_type,
        ge.weight,
        ge.id AS edge_id,
        gt.depth + 1,
        gt.visited || ge.${sql.raw(fromCol)}
      FROM graph_edges ge
      JOIN ${sql.raw(cteName)} gt ON gt.${sql.raw(toCol)} = ge.${sql.raw(fromCol)}
      WHERE gt.depth < ${maxDepth}
        AND NOT (ge.${sql.raw(toCol)} = ANY(gt.visited))
        AND ge.is_accepted = 'accepted'
        AND (${edgeTypes === null} OR ge.edge_type = ANY(${edgeTypes}::text[]))
        AND ge.weight >= ${minWeight}
    `;
  };

  let query;
  if (opts.direction === "both") {
    query = sql`
      WITH RECURSIVE graph_traversal_out AS (
        ${buildBaseCase("outbound")}
        UNION ALL
        ${buildRecursiveCase("outbound", "graph_traversal_out")}
      ),
      graph_traversal_in AS (
        ${buildBaseCase("inbound")}
        UNION ALL
        ${buildRecursiveCase("inbound", "graph_traversal_in")}
      )
      SELECT DISTINCT * FROM (
        SELECT * FROM graph_traversal_out
        UNION ALL
        SELECT * FROM graph_traversal_in
      ) all_traversal
      ORDER BY depth ASC
      LIMIT ${limit}
    `;
  } else {
    query = sql`
      WITH RECURSIVE graph_traversal AS (
        ${buildBaseCase(opts.direction)}
        UNION ALL
        ${buildRecursiveCase(opts.direction, "graph_traversal")}
      )
      SELECT DISTINCT * FROM graph_traversal
      ORDER BY depth ASC
      LIMIT ${limit}
    `;
  }

  const dbResult = await db.execute(query);
  const rows = (Array.isArray(dbResult) ? dbResult : (dbResult as Record<string, unknown>).rows) as { edge_id: string, from_entry_id: string, to_entry_id: string, edge_type: string, weight: number, depth: number, from_content_type: string, to_content_type: string }[];

  const nodesMap = new Map<string, TraversalNode>();
  const edges: TraversalEdge[] = [];

  for (const row of rows) {
    edges.push({
      id: row.edge_id,
      fromEntryId: row.from_entry_id,
      toEntryId: row.to_entry_id,
      edgeType: row.edge_type,
      weight: row.weight,
      depth: row.depth,
    });

    if (row.from_entry_id !== opts.fromEntryId && !nodesMap.has(row.from_entry_id)) {
      nodesMap.set(row.from_entry_id, {
        entryId: row.from_entry_id,
        contentType: row.from_content_type,
        depth: row.depth,
      });
    }
    if (row.to_entry_id !== opts.fromEntryId && !nodesMap.has(row.to_entry_id)) {
      nodesMap.set(row.to_entry_id, {
        entryId: row.to_entry_id,
        contentType: row.to_content_type,
        depth: row.depth,
      });
    }
  }

  const nodes = Array.from(nodesMap.values());
  nodes.sort((a, b) => a.depth - b.depth);

  if (opts.includeData && nodes.length > 0) {
    const entryIds = nodes.map((n) => n.entryId);
    const entries = await db.select().from(contentEntries).where(inArray(contentEntries.id, entryIds));
    const entriesMap = new Map(entries.map((e) => [e.id, e.data]));
    for (const node of nodes) {
      if (entriesMap.has(node.entryId)) {
        node.data = entriesMap.get(node.entryId) as Record<string, unknown>;
      }
    }
  }

  const latencyMs = performance.now() - start;

  return {
    nodes,
    edges,
    rootEntryId: opts.fromEntryId,
    maxDepth,
    totalNodes: nodes.length,
    latencyMs,
  };
}
