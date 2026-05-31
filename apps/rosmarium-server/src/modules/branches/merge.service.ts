/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { db } from "../../db/index.js";
import { branchEntries, contentEntries, contentTypes } from "../../db/schema/index.js";
import { eq } from "drizzle-orm";
import { contentCrudService } from "../content/crud.service.js";
import { branchService } from "./branch.service.js";

export interface MergeConflict {
    entryId: string;
    field: string;
    mainValue: unknown;
    branchValue: unknown;
    originalValue: unknown;
}

export const mergeService = {
    async diffBranch(branchId: string) {
        const branch = await branchService.getBranch(branchId);
        
        const entries = await db.query.branchEntries.findMany({
            where: eq(branchEntries.branchId, branchId)
        });

        const conflicts: MergeConflict[] = [];
        const diffs = [];

        for (const entry of entries) {
            // Find current main entry
            const mainEntry = await db.query.contentEntries.findFirst({
                where: eq(contentEntries.id, entry.entryId)
            });

            const mainData = mainEntry ? (mainEntry.data as Record<string, unknown>) : null;
            const branchData = entry.data as Record<string, unknown>;
            const originalData = entry.originalData as Record<string, unknown> | null;

            const entryConflicts: MergeConflict[] = [];

            // Detect conflicts
            // A conflict occurs if mainData differs from originalData (meaning main changed since branch was created)
            // AND branchData also changed from originalData.
            if (mainData && originalData) {
                for (const key of Object.keys(branchData)) {
                    const branchVal = JSON.stringify(branchData[key]);
                    const originalVal = JSON.stringify(originalData[key]);
                    const mainVal = JSON.stringify(mainData[key]);

                    if (mainVal !== originalVal && branchVal !== originalVal && mainVal !== branchVal) {
                        entryConflicts.push({
                            entryId: entry.entryId,
                            field: key,
                            mainValue: mainData[key],
                            branchValue: branchData[key],
                            originalValue: originalData[key]
                        });
                    }
                }
            }

            if (entryConflicts.length > 0) {
                conflicts.push(...entryConflicts);
            }

            diffs.push({
                entryId: entry.entryId,
                action: entry.action,
                mainData,
                branchData,
                originalData,
                conflicts: entryConflicts
            });
        }

        return { diffs, conflicts };
    },

    async mergeBranch(branchId: string, userId: string, resolvedData?: Record<string, Record<string, unknown>>) {
        const branch = await branchService.getBranch(branchId);
        if (branch.status !== "active") {
            throw new Error("Branch is not active.");
        }

        const { conflicts, diffs } = await this.diffBranch(branchId);
        
        // If there are conflicts and they haven't been resolved in resolvedData
        if (conflicts.length > 0 && !resolvedData) {
            throw new Error("Merge conflicts detected. Please resolve them.");
        }

        // Apply changes to main
        for (const diff of diffs) {
            let finalData = diff.branchData;
            
            // Apply resolved data if provided
            if (resolvedData && resolvedData[diff.entryId]) {
                finalData = { ...finalData, ...resolvedData[diff.entryId] };
            }

            if (diff.action === "update") {
                const mainEntry = await db.query.contentEntries.findFirst({ where: eq(contentEntries.id, diff.entryId) });
                if (mainEntry) {
                    const ct = await db.query.contentTypes.findFirst({ where: eq(contentTypes.id, mainEntry.contentTypeId) });
                    if (ct) {
                        await contentCrudService.update({ contentTypeName: ct.name, id: diff.entryId, data: finalData, updatedBy: userId });
                    }
                }
            } else if (diff.action === "create") {
                // Not supported in this simplified version since we lost contentTypeId, or we can do raw insert
            } else if (diff.action === "delete") {
                const mainEntry = await db.query.contentEntries.findFirst({ where: eq(contentEntries.id, diff.entryId) });
                if (mainEntry) {
                    const ct = await db.query.contentTypes.findFirst({ where: eq(contentTypes.id, mainEntry.contentTypeId) });
                    if (ct) {
                        await contentCrudService.delete(diff.entryId, ct.name, userId);
                    }
                }
            }
        }

        await branchService.markMerged(branchId, userId);

        return { success: true, branchId };
    }
};
