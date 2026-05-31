import { and, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { contentEntries, graphEdges } from "../../db/schema/index.js";


export interface HierarchyNode {
    id: string;
    contentTypeId: string;
    data: Record<string, unknown>;
    children: HierarchyNode[];
}

export const hierarchyService = {
    /**
     * Build the hierarchy tree of content entries using graph_edges of type "parent_of".
     */
    async getTree(): Promise<HierarchyNode[]> {
        // Fetch all entries
        const entries = await db.select().from(contentEntries);
        // Fetch all parent_of edges
        const edges = await db.select().from(graphEdges).where(eq(graphEdges.edgeType, "parent_of"));

        const nodeMap = new Map<string, HierarchyNode>();
        for (const entry of entries) {
            nodeMap.set(entry.id, {
                id: entry.id,
                contentTypeId: entry.contentTypeId,
                data: entry.data as Record<string, unknown>,
                children: []
            });
        }

        const rootNodes: HierarchyNode[] = [];
        const hasParent = new Set<string>();

        // Build relationships
        for (const edge of edges) {
            const parent = nodeMap.get(edge.fromEntryId);
            const child = nodeMap.get(edge.toEntryId);
            if (parent && child) {
                parent.children.push(child);
                hasParent.add(child.id);
            }
        }

        // Roots are nodes that don't have a parent
        for (const node of nodeMap.values()) {
            if (!hasParent.has(node.id)) {
                rootNodes.push(node);
            }
        }

        return rootNodes;
    },

    /**
     * Move an entry to a new parent (or to the root if newParentId is null).
     */
    async moveNode(entryId: string, newParentId: string | null, userId: string): Promise<void> {
        // Find existing parent_of edges where toEntryId = entryId
        await db.transaction(async (tx) => {
            // Delete existing parent edges
            await tx.delete(graphEdges).where(
                and(
                    eq(graphEdges.toEntryId, entryId),
                    eq(graphEdges.edgeType, "parent_of")
                )
            );

            if (newParentId) {
                // Ensure newParentId exists
                const [parent] = await tx.select({ contentTypeId: contentEntries.contentTypeId }).from(contentEntries).where(eq(contentEntries.id, newParentId)).limit(1);
                const [child] = await tx.select({ contentTypeId: contentEntries.contentTypeId }).from(contentEntries).where(eq(contentEntries.id, entryId)).limit(1);
                
                if (!parent || !child) {
                    throw new Error("Parent or child entry not found");
                }

                // Insert new parent_of edge
                await tx.insert(graphEdges).values({
                    fromEntryId: newParentId,
                    fromContentType: parent.contentTypeId,
                    toEntryId: entryId,
                    toContentType: child.contentTypeId,
                    edgeType: "parent_of",
                    source: "manual",
                    createdBy: userId,
                });
            }
        });
        
        // Removed rosmariumEvents.emit("content.hierarchy.moved") as it is not defined in events type.
    }
};
