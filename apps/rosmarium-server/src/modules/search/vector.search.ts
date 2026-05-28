/**
 * pgvector cosine similarity search.
 *
 * Queries the per-content-type embeddings table: rosmarium_{contentType}_embeddings
 * These tables are created by rosmarium-ai-worker's VectorIndexManager.
 *
 * Gracefully returns [] when:
 *   - The table doesn't exist yet (no entries embedded)
 *   - allowedEntryIds is provided but empty
 *
 * See: .agent/skills/pgvector-ops/SKILL.md for index patterns.
 */

import { sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { logger } from "../../lib/logger.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VectorSearchResult {
    contentEntryId: string;
    chunkIndex: number;
    chunkText: string;
    score: number;
}

// ─── Vector search ────────────────────────────────────────────────────────────

// PostgreSQL error code for "relation does not exist"
const PG_RELATION_NOT_EXISTS = "42P01";

/**
 * Sanitize content type name used in table name construction.
 * Only allow alphanumeric + underscore to prevent SQL injection.
 */
function sanitizeContentTypeName(name: string): string {
    if (!/^[a-z0-9_]+$/i.test(name)) {
        throw new Error(`Invalid content type name for vector search: '${name}'`);
    }
    return name.toLowerCase().replace(/[^a-z0-9_]/g, "");
}

export async function vectorSearch(opts: {
    embedding: number[];
    contentType: string;
    allowedEntryIds?: string[];
    limit: number;
}): Promise<VectorSearchResult[]> {
    const { embedding, contentType, allowedEntryIds, limit } = opts;

    // If an ACL filter was provided but is empty, no results are possible
    if (allowedEntryIds !== undefined && allowedEntryIds.length === 0) {
        return [];
    }

    const safeTableName = sanitizeContentTypeName(contentType);
    const tableName = `rosmarium_${safeTableName}_embeddings`;
    const embeddingLiteral = `[${embedding.join(",")}]`;

    try {
        const rows = await db.execute(sql.raw(`
            SELECT
                content_entry_id,
                chunk_index,
                chunk_text,
                1 - (embedding <=> '${embeddingLiteral}'::vector) AS score
            FROM ${tableName}
            ${allowedEntryIds ? `WHERE content_entry_id = ANY(ARRAY[${allowedEntryIds.map((id) => `'${id.replace(/'/g, "''")}'`).join(",")}]::text[])` : ""}
            ORDER BY embedding <=> '${embeddingLiteral}'::vector
            LIMIT ${limit}
        `));

        return rows.map((row) => ({
            contentEntryId: String(row["content_entry_id"]),
            chunkIndex: Number(row["chunk_index"]),
            chunkText: String(row["chunk_text"]),
            score: Number(row["score"]),
        }));
    } catch (err: unknown) {
        // Graceful degradation: table doesn't exist yet (no embeddings for this type)
        const pgCode =
            err !== null && typeof err === "object" && "code" in err
                ? (err as { code: string }).code
                : null;

        if (pgCode === PG_RELATION_NOT_EXISTS) {
            logger.debug({
                msg: "vector_search_table_not_found",
                table: tableName,
                content_type: contentType,
            });
            return [];
        }

        throw err;
    }
}
