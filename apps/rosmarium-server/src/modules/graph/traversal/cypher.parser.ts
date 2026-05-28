import { sql, SQL } from "drizzle-orm";
import { db } from "../../../db/index.js";
import type { TraversalNode } from "./traversal.engine.js";

export class CypherParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CypherParseError";
  }
}

export interface CypherAST {
  match: {
    startNode: string;
    startId: string;
    relationships: {
      relName: string;
      edgeType: string | null;
      minDepth: number;
      maxDepth: number;
      targetNode: string;
    }[];
  };
  where: { node: string; property: string; value: string }[];
  returns: string[];
  limit: number;
}

export interface CypherQuery {
  raw: string;
  ast: CypherAST;
  sql: string;
  params: unknown[];
}

export function parseCypher(query: string): CypherQuery {
  const upperQuery = query.toUpperCase();

  if (upperQuery.includes("CREATE") || upperQuery.includes("DELETE") || upperQuery.includes("SET")) {
    throw new CypherParseError("Write operations are not supported in read-only Cypher DSL");
  }

  const matchMatch = query.match(/MATCH\s+(.+?)(?=\s+WHERE|\s+RETURN|\s+LIMIT|$)/is);
  if (!matchMatch) {
    throw new CypherParseError("Query must contain a MATCH clause");
  }

  const matchClause = matchMatch[1]!.trim();

  // Parse `(n {id: "entry-id"})`
  const startNodeMatch = matchClause.match(/^\((\w+)\s*\{\s*id\s*:\s*['"]([^'"]+)['"]\s*\}\)/);
  if (!startNodeMatch) {
    throw new CypherParseError("MATCH clause must start with a node specifying an id, e.g., (n {id: '...'})");
  }

  const startNode = startNodeMatch[1]!;
  const startId = startNodeMatch[2]!;

  let remainingMatch = matchClause.substring(startNodeMatch[0].length);
  const relationships: {
    relName: string;
    edgeType: string | null;
    minDepth: number;
    maxDepth: number;
    targetNode: string;
  }[] = [];
  const nodesInMatch = new Set<string>();
  nodesInMatch.add(startNode);

  // Parse `-[r:EDGE_TYPE*1..3]->(m)` or `-[:EDGE_TYPE]->(m)`
  const relRegex = /^-\[\s*(\w*)\s*(?::\s*(\w+))?\s*(?:\*\s*(\d+)?\.\.(\d+)?)?\s*\]->\((\w+)\)/;
  
  while (remainingMatch.trim().length > 0) {
    remainingMatch = remainingMatch.trim();
    const relMatch = remainingMatch.match(relRegex);
    if (!relMatch) {
      throw new CypherParseError("Invalid relationship syntax in MATCH clause");
    }

    const relName = relMatch[1] ? relMatch[1] : `rel_${relationships.length}`;
    const edgeType = relMatch[2] ? relMatch[2] : null;
    const minDepth = relMatch[3] ? parseInt(relMatch[3], 10) : 1;
    const maxDepth = relMatch[4] ? parseInt(relMatch[4], 10) : 1;
    const targetNode = relMatch[5]!;

    if (maxDepth > 5) {
      throw new CypherParseError("Relationship depth exceeds maximum allowed (*1..5)");
    }

    relationships.push({
      relName,
      edgeType,
      minDepth,
      maxDepth,
      targetNode,
    });
    nodesInMatch.add(targetNode);

    remainingMatch = remainingMatch.substring(relMatch[0].length);
  }

  // Parse WHERE
  const whereConditions: { node: string; property: string; value: string }[] = [];
  const whereMatch = query.match(/WHERE\s+(.+?)(?=\s+RETURN|\s+LIMIT|$)/is);
  if (whereMatch) {
    const conditions = whereMatch[1]!.split(/\s+AND\s+/i);
    for (const cond of conditions) {
      const parts = cond.split("=");
      if (parts.length !== 2) throw new CypherParseError("Invalid WHERE condition syntax");
      const left = parts[0]!.trim();
      const right = parts[1]!.trim().replace(/^['"]|['"]$/g, "");
      const [node, property] = left.split(".");
      if (!node || !property) throw new CypherParseError("WHERE condition left side must be node.property");
      
      if (!nodesInMatch.has(node)) {
        throw new CypherParseError(`WHERE condition references undefined node '${node}'`);
      }
      
      whereConditions.push({ node, property, value: right });
    }
  }

  // Parse RETURN
  const returnMatch = query.match(/RETURN\s+(.+?)(?=\s+LIMIT|$)/is);
  if (!returnMatch) {
    throw new CypherParseError("Query must contain a RETURN clause");
  }
  const returns = returnMatch[1]!.split(",").map((s) => s.trim());
  for (const r of returns) {
    if (!nodesInMatch.has(r)) {
      throw new CypherParseError(`RETURN references a node '${r}' not in MATCH`);
    }
  }

  // Parse LIMIT
  let limit = 50;
  const limitMatch = query.match(/LIMIT\s+(\d+)/i);
  if (limitMatch) {
    limit = parseInt(limitMatch[1]!, 10);
  }

  const ast: CypherAST = {
    match: { startNode, startId, relationships },
    where: whereConditions,
    returns,
    limit,
  };

  // Convert AST to SQL.
  // We'll generate a CTE for each relationship hop.
  let sqlString = ``;
  const params: unknown[] = [];

  // For a single multi-hop, we could use recursive CTE, but the request implies standard parameterised SQL execution.
  // Let's implement a recursive CTE for the first relationship to support depths.
  // Assuming a simple linear path: (n)-[...]->(m)
  
  if (relationships.length > 1) {
    throw new CypherParseError("Cypher-lite parser currently only supports a single relationship hop (e.g. (n)-[]->(m))");
  }

  const rel = relationships[0]!;
  
  params.push(startId);
  const startIdParamIdx = params.length;
  
  let edgeTypeCondition = "";
  if (rel.edgeType) {
    params.push(rel.edgeType);
    edgeTypeCondition = `AND ge.edge_type = $${params.length}`;
  }

  // Recursive CTE for traversal
  sqlString = `
    WITH RECURSIVE traverse AS (
      SELECT
        ge.from_entry_id,
        ge.to_entry_id,
        ge.from_content_type,
        ge.to_content_type,
        1 as depth,
        ARRAY[ge.from_entry_id] as visited
      FROM graph_edges ge
      WHERE ge.from_entry_id = $${startIdParamIdx}
        AND ge.is_accepted = 'accepted'
        ${edgeTypeCondition}
      
      UNION ALL
      
      SELECT
        ge.from_entry_id,
        ge.to_entry_id,
        ge.from_content_type,
        ge.to_content_type,
        t.depth + 1,
        t.visited || ge.from_entry_id
      FROM graph_edges ge
      JOIN traverse t ON t.to_entry_id = ge.from_entry_id
      WHERE t.depth < ${rel.maxDepth}
        AND NOT (ge.to_entry_id = ANY(t.visited))
        AND ge.is_accepted = 'accepted'
        ${edgeTypeCondition}
    )
    SELECT DISTINCT t.to_entry_id as entry_id, t.to_content_type as content_type, t.depth
    FROM traverse t
    LEFT JOIN content_entries ce ON ce.id = t.to_entry_id
    WHERE t.depth >= ${rel.minDepth}
  `;

  for (const cond of whereConditions) {
    if (cond.node === rel.targetNode) {
      if (cond.property === "status") {
        params.push(cond.value);
        sqlString += ` AND ce.status = $${params.length}`;
      } else if (cond.property === "contentType") {
        params.push(cond.value);
        sqlString += ` AND ce.content_type_id = $${params.length}`;
      } else {
        params.push(cond.value);
        sqlString += ` AND ce.data->>'${cond.property}' = $${params.length}`;
      }
    }
  }

  sqlString += ` LIMIT ${limit}`;

  return {
    raw: query,
    ast,
    sql: sqlString,
    params,
  };
}

export async function executeCypher(query: string): Promise<TraversalNode[]> {
  const parsed = parseCypher(query);

  // Re-build parameterized SQL using Drizzle sql tag to prevent injection and pass safely
  // Since we already parsed params array, we need to map `$1, $2` to Drizzle parameterized queries.
  // An easier way is just passing it to db.execute with the query string and params array if the driver supports it,
  // Drizzle's db.execute accepts { sql: string, params: any[] } format for raw postgres.
  
  // Actually, Drizzle allows: db.execute(sql.raw(parsed.sql)) with manually inserting params? No, that's injection.
  // Instead, construct the sql template directly.
  
  // Since we know the params, we can do:
  // db.execute(sql`...`)
  // Let's replace $1, $2 in parsed.sql with ${parsed.params[0]}, ${parsed.params[1]}.
  const parts = parsed.sql.split(/\$(\d+)/);
  const sqlChunks: SQL[] = [];
  
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      sqlChunks.push(sql.raw(parts[i]!));
    } else {
      const paramIndex = parseInt(parts[i]!, 10) - 1;
      sqlChunks.push(parsed.params[paramIndex] as SQL);
    }
  }
  
  const executableSql = sql.join(sqlChunks, sql.raw(""));
  const dbResult = await db.execute(executableSql);
  const rows = Array.isArray(dbResult) ? dbResult : (dbResult as Record<string, unknown>).rows as Record<string, unknown>[];

  return rows.map((row: Record<string, unknown>) => ({
    entryId: String(row.entry_id),
    contentType: String(row.content_type),
    depth: Number(row.depth),
  }));
}
