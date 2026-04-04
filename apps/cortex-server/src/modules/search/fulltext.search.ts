/**
 * BM25 full-text search using PostgreSQL tsvector + plainto_tsquery.
 *
 * Uses the search_vector generated column on content_entries,
 * which covers: data->>'title', data->>'body', data->>'description'.
 *
 * plainto_tsquery is used (not to_tsquery) because it handles natural language
 * input without operator syntax errors on arbitrary user queries.
 */

import { sql } from "drizzle-orm";
import { db } from "../../db/index.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SearchResult {
    id: string;
    contentTypeId: string;
    data: Record<string, unknown>;
    status: string;
    publishedAt: Date | null;
    createdBy: string | null;
    rank: number;
    snippet: string | null;
}

// ─── Full-text search ─────────────────────────────────────────────────────────

export async function fulltextSearch(opts: {
    query: string;
    contentTypeId?: string;
    locale?: string;
    status?: string;
    limit: number;
}): Promise<SearchResult[]> {
    const { query, contentTypeId, locale, status, limit } = opts;

    // Empty query returns nothing — no tsvector match possible
    if (!query.trim()) return [];

    const rows = await db.execute(sql`
        SELECT
            ce.id,
            ce.content_type_id,
            ce.data,
            ce.status,
            ce.published_at,
            ce.created_by,
            ts_rank_cd(
                ce.search_vector,
                plainto_tsquery('english', ${query})
            ) AS rank,
            ts_headline(
                'english',
                COALESCE(ce.data->>'body', ce.data->>'description', ce.data->>'title', ''),
                plainto_tsquery('english', ${query}),
                'MaxFragments=2, MaxWords=30, MinWords=10, StartSel=<mark>, StopSel=</mark>'
            ) AS snippet
        FROM content_entries ce
        WHERE
            ce.search_vector @@ plainto_tsquery('english', ${query})
            AND (${contentTypeId ?? null}::text IS NULL OR ce.content_type_id = ${contentTypeId ?? null})
            AND (${locale ?? null}::text IS NULL OR ce.locale = ${locale ?? null})
            AND (${status ?? null}::text IS NULL OR ce.status = ${status ?? null})
        ORDER BY rank DESC
        LIMIT ${limit}
    `);

    return rows.map((row) => ({
        id: String(row["id"]),
        contentTypeId: String(row["content_type_id"]),
        data: (row["data"] as Record<string, unknown>) ?? {},
        status: String(row["status"]),
        publishedAt: row["published_at"] ? new Date(String(row["published_at"])) : null,
        createdBy: row["created_by"] ? String(row["created_by"]) : null,
        rank: Number(row["rank"]),
        snippet: row["snippet"] ? String(row["snippet"]) : null,
    }));
}
