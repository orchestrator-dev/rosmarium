/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { db } from "../../db/index.js";
import { contentBranches, branchEntries, contentEntries } from "../../db/schema/index.js";
import { eq, and, desc } from "drizzle-orm";

export const branchService = {
    async createBranch(name: string, userId: string, baseBranchId?: string) {
        if (baseBranchId) {
            const base = await db.query.contentBranches.findFirst({
                where: eq(contentBranches.id, baseBranchId)
            });
            if (!base) {
                throw new Error("Base branch not found");
            }
        }
        
        const [branch] = await db.insert(contentBranches).values({
            name,
            baseBranchId: baseBranchId || null,
            createdBy: userId,
            status: "active"
        }).returning();
        
        return branch;
    },

    async listBranches() {
        return db.query.contentBranches.findMany({
            orderBy: [desc(contentBranches.createdAt)],
            with: {
                // If we want to include creator data later we could relationally join, but keeping simple for now.
            }
        });
    },

    async getBranch(branchId: string) {
        const branch = await db.query.contentBranches.findFirst({
            where: eq(contentBranches.id, branchId)
        });
        if (!branch) {
                throw new Error("Branch not found");
        }
        return branch;
    },

    async saveBranchEntry(branchId: string, entryId: string, action: "create" | "update" | "delete", data: Record<string, unknown>, originalData?: Record<string, unknown>) {
        const branch = await this.getBranch(branchId);
        if (branch.status !== "active") {
            throw new Error("Cannot edit an inactive branch");
        }

        // Check if there's an existing branch entry to update
        const existing = await db.query.branchEntries.findFirst({
            where: and(eq(branchEntries.branchId, branchId), eq(branchEntries.entryId, entryId))
        });

        if (existing) {
            const [updated] = await db.update(branchEntries).set({
                action,
                data,
                // originalData stays the same as when it was first branched
                updatedAt: new Date()
            })
            .where(eq(branchEntries.id, existing.id))
            .returning();
            return updated;
        } else {
            const [created] = await db.insert(branchEntries).values({
                branchId,
                entryId,
                action,
                data,
                originalData: originalData || null
            }).returning();
            return created;
        }
    },

    async abandonBranch(branchId: string) {
        const [updated] = await db.update(contentBranches).set({
            status: "abandoned",
            updatedAt: new Date()
        }).where(eq(contentBranches.id, branchId)).returning();
        return updated;
    },

    async markMerged(branchId: string, userId: string) {
        const [updated] = await db.update(contentBranches).set({
            status: "merged",
            mergedAt: new Date(),
            mergedBy: userId,
            updatedAt: new Date()
        }).where(eq(contentBranches.id, branchId)).returning();
        return updated;
    }
};
