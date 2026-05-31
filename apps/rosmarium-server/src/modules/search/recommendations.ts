import { db } from "../../db/index.js";
import { aiWorkerClient } from "./ai-worker.client.js";
import { vectorSearch, VectorSearchResult } from "./vector.search.js";

export const recommendationService = {
    /**
     * Recommends related content for a given entry by combining 
     * vector similarity and structural graph proximity.
     */
    async getRelatedContent(entryId: string, limit: number = 5) {
        // 1. Get the entry data to embed
        const entryRows = await db.execute(`
            SELECT id, content_type_id, data FROM content_entries WHERE id = '${entryId}'
        `);
        const entry = entryRows[0];
        if (!entry) throw new Error("Entry not found");

        const typedEntry = entry as { content_type_id: string; data?: { title?: string; description?: string; body?: string } };
        const textToEmbed = [
            typedEntry.data?.title,
            typedEntry.data?.description,
            typedEntry.data?.body
        ].filter(Boolean).join(" ");

        // 2. Vector Search
        let vectorResults: VectorSearchResult[] = [];
        try {
            const embedResult = await aiWorkerClient.embedQuery(textToEmbed);
            vectorResults = await vectorSearch({
                embedding: embedResult.embedding,
                contentType: typedEntry.content_type_id,
                limit: limit * 2,
            });
        } catch {
            console.warn("Vector search failed, falling back to graph proximity only");
        }

        // 3. Graph Proximity
        const graphResults = await db.execute(`
            WITH RECURSIVE graph_paths AS (
                SELECT 
                    id, 
                    source_node_id, 
                    target_node_id, 
                    1 AS depth
                FROM graph_edges
                WHERE source_node_id = '${entryId}' OR target_node_id = '${entryId}'
                
                UNION
                
                SELECT 
                    e.id, 
                    e.source_node_id, 
                    e.target_node_id, 
                    gp.depth + 1
                FROM graph_edges e
                INNER JOIN graph_paths gp 
                ON e.source_node_id = gp.target_node_id OR e.target_node_id = gp.source_node_id
                WHERE gp.depth < 3
            )
            SELECT 
                target_node_id as related_id,
                MIN(depth) as min_depth
            FROM graph_paths
            WHERE target_node_id != '${entryId}'
            GROUP BY target_node_id
            ORDER BY min_depth ASC
            LIMIT ${limit * 2}
        `);

        // 4. Merge and Score
        const scores = new Map<string, number>();

        vectorResults.forEach((vr: VectorSearchResult, idx: number) => {
            if (vr.contentEntryId !== entryId) {
                // simple rank-based score
                const score = 1 / (idx + 1);
                scores.set(vr.contentEntryId, (scores.get(vr.contentEntryId) || 0) + score);
            }
        });

        graphResults.forEach((gr: Record<string, unknown>) => {
            const score = 1 / ((gr.min_depth as number) + 1);
            scores.set(gr.related_id as string, (scores.get(gr.related_id as string) || 0) + score);
        });

        const sorted = Array.from(scores.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(([id]) => id);

        if (sorted.length === 0) return [];

        const relatedEntries = await db.execute(`
            SELECT id, content_type_id, status, data->>'title' as title
            FROM content_entries
            WHERE id IN (${sorted.map(id => `'${id}'`).join(',')})
        `);

        // Order by the scored list
        return sorted.map(id => relatedEntries.find((e: Record<string, unknown>) => e.id === id)).filter(Boolean);
    }
};
