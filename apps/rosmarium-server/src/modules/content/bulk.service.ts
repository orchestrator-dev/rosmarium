import { inArray } from "drizzle-orm";
import { db } from "../../db/index.js";
import { contentEntries, auditLog } from "../../db/schema/index.js";
import { intelligenceService } from "../intelligence/intelligence.service.js";
import { rosmariumEvents } from "../../lib/events.js";

export type BulkAction = "publish" | "unpublish" | "delete" | "archive" | "tag" | "summarize";

export const contentBulkService = {
    async executeBulkAction(opts: {
        action: BulkAction;
        entryIds: string[];
        userId: string;
        // For AI actions
        labels?: string[];
        style?: "brief" | "detailed" | "bullet";
    }): Promise<{ successCount: number; errors: string[] }> {
        if (!opts.entryIds || opts.entryIds.length === 0) {
            return { successCount: 0, errors: ["No entries selected"] };
        }

        const errors: string[] = [];
        let successCount = 0;

        // Fetch entries to ensure they exist and we have their types
        const entries = await db
            .select()
            .from(contentEntries)
            .where(inArray(contentEntries.id, opts.entryIds));

        const entryMap = new Map(entries.map((e) => [e.id, e]));

        if (opts.action === "delete") {
            // Transactional delete
            try {
                await db.transaction(async (tx) => {
                    const deleted = await tx
                        .delete(contentEntries)
                        .where(inArray(contentEntries.id, opts.entryIds))
                        .returning({ id: contentEntries.id });

                    if (deleted.length > 0) {
                        await tx.insert(auditLog).values(
                            deleted.map((d) => ({
                                userId: opts.userId,
                                action: "content.deleted",
                                resourceId: d.id,
                                resourceType: "content_entry",
                            }))
                        );
                    }
                });

                for (const entry of entries) {
                    rosmariumEvents.emit("content.deleted", entry.id, entry.contentTypeId);
                }
                successCount = entries.length;
            } catch (err) {
                errors.push(`Bulk delete failed: ${err instanceof Error ? err.message : "Unknown error"}`);
            }
            return { successCount, errors };
        }

        if (opts.action === "publish" || opts.action === "unpublish" || opts.action === "archive") {
            const status = opts.action === "publish" ? "published" : opts.action === "archive" ? "archived" : "draft";
            
            try {
                await db.transaction(async (tx) => {
                    const updated = await tx
                        .update(contentEntries)
                        .set({ 
                            status, 
                            updatedBy: opts.userId, 
                            updatedAt: new Date(),
                            publishedAt: opts.action === "publish" ? new Date() : opts.action === "unpublish" ? null : undefined
                        })
                        .where(inArray(contentEntries.id, opts.entryIds))
                        .returning();

                    if (updated.length > 0) {
                        await tx.insert(auditLog).values(
                            updated.map((u) => ({
                                userId: opts.userId,
                                action: `content.${opts.action}`,
                                resourceId: u.id,
                                resourceType: "content_entry",
                            }))
                        );
                    }
                });

                for (const entry of entries) {
                    if (opts.action === "publish") rosmariumEvents.emit("content.published", entry);
                    else if (opts.action === "unpublish") rosmariumEvents.emit("content.unpublished", entry);
                    else rosmariumEvents.emit("content.updated", entry);
                }
                successCount = entries.length;
            } catch (err) {
                errors.push(`Bulk ${opts.action} failed: ${err instanceof Error ? err.message : "Unknown error"}`);
            }
            return { successCount, errors };
        }

        if (opts.action === "tag") {
            // Process AI sequentially or in parallel?
            // Tagging can be parallel but let's limit concurrency to not overwhelm the intelligence worker
            for (const id of opts.entryIds) {
                const entry = entryMap.get(id);
                if (!entry) {
                    errors.push(`Entry ${id} not found`);
                    continue;
                }
                try {
                    // Extract text for tagging
                    const text = JSON.stringify(entry.data);
                    await intelligenceService.tagEntry({
                        entryId: id,
                        text,
                        labels: opts.labels || ["auto"],
                        save: true
                    });
                    successCount++;
                } catch (err) {
                    errors.push(`Tagging failed for ${id}: ${err instanceof Error ? err.message : "Unknown error"}`);
                }
            }
            return { successCount, errors };
        }

        if (opts.action === "summarize") {
            for (const id of opts.entryIds) {
                const entry = entryMap.get(id);
                if (!entry) {
                    errors.push(`Entry ${id} not found`);
                    continue;
                }
                try {
                    const text = JSON.stringify(entry.data);
                    await intelligenceService.summarize({
                        entryId: id,
                        text,
                        save: true,
                        style: opts.style || "brief"
                    });
                    successCount++;
                } catch (err) {
                    errors.push(`Summarize failed for ${id}: ${err instanceof Error ? err.message : "Unknown error"}`);
                }
            }
            return { successCount, errors };
        }

        return { successCount, errors: ["Unknown action"] };
    }
};
