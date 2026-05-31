import { db } from "../../db/index.js";
import { workflows, workflowHistory, contentEntries } from "../../db/schema/index.js";
import { eq, desc } from "drizzle-orm";
import type { WorkflowDefinition } from "@orchestrator.dev/types";
import { rosmariumEvents } from "../../lib/events.js";
import { TRPCError } from "@trpc/server";
import { rbacService } from "../rbac/rbac.service.js";

export const workflowService = {
    async getWorkflows() {
        return db.select().from(workflows).orderBy(desc(workflows.createdAt));
    },

    async getWorkflowForContentType(contentTypeId: string) {
        const allWorkflows = await this.getWorkflows();
        const specific = allWorkflows.find(w => w.definition.contentTypes.includes(contentTypeId));
        if (specific) return specific;
        const def = allWorkflows.find(w => w.isDefault);
        return def || null;
    },

    async createWorkflow(data: { name: string; definition: WorkflowDefinition; isDefault: boolean }) {
        if (data.isDefault) {
            await db.update(workflows).set({ isDefault: false });
        }
        const [w] = await db.insert(workflows).values({
            name: data.name,
            definition: data.definition,
            isDefault: data.isDefault
        }).returning();
        return w;
    },

    async updateWorkflow(id: string, data: { name?: string; definition?: WorkflowDefinition; isDefault?: boolean }) {
        if (data.isDefault) {
            await db.update(workflows).set({ isDefault: false });
        }
        const [w] = await db.update(workflows).set({ ...data, updatedAt: new Date() })
            .where(eq(workflows.id, id))
            .returning();
        return w;
    },

    async deleteWorkflow(id: string) {
        await db.delete(workflows).where(eq(workflows.id, id));
    },

    async getHistory(entryId: string) {
        return db.select().from(workflowHistory).where(eq(workflowHistory.entryId, entryId)).orderBy(desc(workflowHistory.performedAt));
    },

    async transition(entryId: string, toState: string, userId: string, comment?: string) {
        return db.transaction(async (tx) => {
            const [entry] = await tx.select().from(contentEntries).where(eq(contentEntries.id, entryId));
            if (!entry) throw new TRPCError({ code: "NOT_FOUND", message: "Entry not found" });

            const wfRow = await this.getWorkflowForContentType(entry.contentTypeId);
            if (!wfRow) throw new TRPCError({ code: "BAD_REQUEST", message: "No workflow configured for this content type" });

            const def = wfRow.definition;
            const currentState = entry.status;
            
            const transition = def.transitions.find(t => t.from === currentState && t.to === toState);
            if (!transition && currentState !== toState) {
                throw new TRPCError({ code: "BAD_REQUEST", message: `Invalid transition from ${currentState} to ${toState}` });
            }

            if (transition) {
                if (transition.requiredRole) {
                    const roles = await rbacService.getUserRoles(userId, "default"); // Assuming default tenant for now or role check is global
                    if (!roles.some(r => r.name === transition.requiredRole || r.name === "admin")) {
                        throw new TRPCError({ code: "FORBIDDEN", message: `Role ${transition.requiredRole} required for this transition` });
                    }
                }
                if (transition.requireComment && !comment) {
                    throw new TRPCError({ code: "BAD_REQUEST", message: "Comment is required for this transition" });
                }
                if (transition.conditions && transition.conditions.length > 0) {
                    for (const cond of transition.conditions) {
                        const val = (entry.data as Record<string, unknown>)[cond.field];
                        let pass = false;
                        switch (cond.operator) {
                            case "empty": pass = !val; break;
                            case "not_empty": pass = !!val; break;
                            case "eq": pass = val === cond.value; break;
                            case "neq": pass = val !== cond.value; break;
                        }
                        if (!pass) throw new TRPCError({ code: "BAD_REQUEST", message: `Transition condition not met for field ${cond.field}` });
                    }
                }
            }

            await tx.update(contentEntries).set({ status: toState, updatedAt: new Date() }).where(eq(contentEntries.id, entryId));

            await tx.insert(workflowHistory).values({
                entryId,
                fromState: currentState,
                toState,
                transitionLabel: transition?.label || "Manual Update",
                comment,
                performedBy: userId
            });

            if (transition?.webhookEvent) {
                rosmariumEvents.emit("webhook:trigger", {
                    tenantId: "default",
                    event: transition.webhookEvent,
                    payload: { entryId, from: currentState, to: toState }
                });
            }

            return { success: true };
        });
    }
};
