import { sql } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { traverse } from "./traversal.engine.js";
import { vectorSearch } from "../../search/vector.search.js";
import { rbacService } from "../../rbac/rbac.service.js";
import type { AuthenticatedUser } from "../../auth/auth.service.js";
import { contentEntries } from "../../../db/schema/index.js";
import { inArray } from "drizzle-orm";

export interface Recommendation {
  entryId: string;
  contentType: string;
  data?: Record<string, unknown>;
  graphScore: number;
  semanticScore: number;
  combinedScore: number;
  reasons: string[];
}

function sanitizeContentTypeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9_]/g, "");
}

export async function getRecommendations(opts: {
  entryId: string;
  contentType: string;
  limit?: number; // default 5
  user: AuthenticatedUser;
}): Promise<Recommendation[]> {
  const limit = opts.limit ?? 5;

  // Stage 1: Graph proximity candidates
  const traversalResult = await traverse({
    fromEntryId: opts.entryId,
    direction: "both",
    maxDepth: 2,
    includeData: true,
  });

  const graphScores = new Map<string, { score: number; reasons: string[] }>();
  for (const node of traversalResult.nodes) {
    if (node.entryId === opts.entryId) continue;

    // score = 1 / depth
    const score = 1 / node.depth;
    
    // Find the edge that connects to it for the reason
    const edgesToNode = traversalResult.edges.filter(
      (e) => e.toEntryId === node.entryId || e.fromEntryId === node.entryId
    );
    const reasons = edgesToNode.map((e) => `${node.depth} hop(s) via ${e.edgeType}`);
    const uniqueReasons = [...new Set(reasons)];

    graphScores.set(node.entryId, {
      score,
      reasons: uniqueReasons,
    });
  }

  // Stage 2: Semantic similarity candidates
  const safeTableName = sanitizeContentTypeName(opts.contentType);
  const tableName = `rosmarium_${safeTableName}_embeddings`;
  
  let semanticCandidates: { contentEntryId: string; score: number }[] = [];
  try {
    // Fetch embedding for the target entry
    const embeddingRows = await db.execute(sql.raw(`
      SELECT embedding::text
      FROM ${tableName}
      WHERE content_entry_id = '${opts.entryId.replace(/'/g, "''")}'
      LIMIT 1
    `));

    const eRows = (Array.isArray(embeddingRows) ? embeddingRows : (embeddingRows as Record<string, unknown>).rows) as Record<string, unknown>[];

    if (eRows.length > 0) {
      const embeddingStr = eRows[0]!["embedding"] as string;
      const embedding = JSON.parse(embeddingStr); // e.g., "[0.1, 0.2, ...]"

      const searchResults = await vectorSearch({
        embedding,
        contentType: opts.contentType,
        limit: 10,
      });

      semanticCandidates = searchResults.filter((r) => r.contentEntryId !== opts.entryId);
    }
  } catch (err: unknown) {
    if ((err as { code?: string })?.code !== "42P01") {
      throw err;
    }
  }

  const semanticScores = new Map<string, { score: number; reasons: string[] }>();
  for (const candidate of semanticCandidates) {
    if (!semanticScores.has(candidate.contentEntryId)) {
      semanticScores.set(candidate.contentEntryId, {
        score: candidate.score,
        reasons: [`similar content (score: ${candidate.score.toFixed(2)})`],
      });
    }
  }

  // Merge Candidates
  const allIds = new Set([...graphScores.keys(), ...semanticScores.keys()]);
  const rawRecommendations: Recommendation[] = [];

  for (const id of allIds) {
    const gData = graphScores.get(id);
    const sData = semanticScores.get(id);

    const graphScore = gData?.score ?? 0;
    const semanticScore = sData?.score ?? 0;

    const combinedScore = 0.6 * graphScore + 0.4 * semanticScore;
    const reasons = [...(gData?.reasons ?? []), ...(sData?.reasons ?? [])];

    let contentType = "";
    let data: Record<string, unknown> | undefined;

    // Try to get node data from traversal result
    const tNode = traversalResult.nodes.find((n) => n.entryId === id);
    if (tNode) {
      contentType = tNode.contentType;
      data = tNode.data;
    }

    rawRecommendations.push({
      entryId: id,
      contentType,
      data,
      graphScore,
      semanticScore,
      combinedScore,
      reasons,
    });
  }

  // Populate missing node info (if came purely from semantic search)
  const missingDataIds = rawRecommendations.filter((r) => !r.contentType).map((r) => r.entryId);
  if (missingDataIds.length > 0) {
    const entries = await db.select().from(contentEntries).where(inArray(contentEntries.id, missingDataIds));
    for (const entry of entries) {
      const rec = rawRecommendations.find((r) => r.entryId === entry.id);
      if (rec) {
        rec.contentType = entry.contentTypeId;
        rec.data = entry.data as Record<string, unknown>;
      }
    }
  }

  // Filter out any that still don't have a content type (deleted entries?)
  const validRecs = rawRecommendations.filter((r) => r.contentType);

  // Apply RBAC: filter out entries user cannot read
  const filteredRecs = validRecs.filter((rec) => {
    return rbacService.canAccessEntry(
      opts.user,
      { id: rec.entryId, contentTypeId: rec.contentType, data: rec.data ?? {}, createdBy: null },
      "read"
    );
  });

  filteredRecs.sort((a, b) => b.combinedScore - a.combinedScore);

  return filteredRecs.slice(0, limit);
}
