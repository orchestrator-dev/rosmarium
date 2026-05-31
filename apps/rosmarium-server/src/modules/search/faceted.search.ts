import { sql } from "drizzle-orm";
import { db } from "../../db/index.js";

export interface FacetedSearchParams {
    query?: string;
    filters?: {
        contentTypeId?: string;
        status?: string;
        locale?: string;
        dateRange?: { start?: string; end?: string };
        tags?: string[];
    };
    limit?: number;
    offset?: number;
}

export const facetedSearchService = {
    async search(params: FacetedSearchParams) {
        const { filters = {}, limit = 20, offset = 0, query } = params;
        
        let filterSql = sql`1=1`;
        
        if (filters.contentTypeId) {
            filterSql = sql`${filterSql} AND content_type_id = ${filters.contentTypeId}`;
        }
        if (filters.status) {
            filterSql = sql`${filterSql} AND status = ${filters.status}`;
        }
        if (filters.locale) {
            filterSql = sql`${filterSql} AND locale = ${filters.locale}`;
        }
        if (filters.dateRange?.start) {
            filterSql = sql`${filterSql} AND created_at >= ${new Date(filters.dateRange.start)}`;
        }
        if (filters.dateRange?.end) {
            filterSql = sql`${filterSql} AND created_at <= ${new Date(filters.dateRange.end)}`;
        }
        if (filters.tags && filters.tags.length > 0) {
            // Check JSONB tags array using the `@>` operator
            filterSql = sql`${filterSql} AND metadata->'tags' @> ${JSON.stringify(filters.tags)}`;
        }
        if (query) {
            filterSql = sql`${filterSql} AND data->>'title' ILIKE ${'%' + query + '%'}`;
        }

        const dataRows = await db.execute(sql`
            SELECT id, content_type_id, status, locale, data
            FROM content_entries
            WHERE ${filterSql}
            ORDER BY created_at DESC
            LIMIT ${limit} OFFSET ${offset}
        `);

        const aggs = await db.execute(sql`
            SELECT
                content_type_id as "contentType",
                COUNT(*) as "count"
            FROM content_entries
            WHERE ${filterSql}
            GROUP BY content_type_id
        `);

        const statusAggs = await db.execute(sql`
            SELECT
                status,
                COUNT(*) as "count"
            FROM content_entries
            WHERE ${filterSql}
            GROUP BY status
        `);

        return {
            items: dataRows,
            aggregations: {
                contentTypes: aggs,
                statuses: statusAggs,
            }
        };
    }
};
