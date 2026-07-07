import { describe, it, expect, beforeEach, vi } from "vitest";
import { createId } from "@paralleldrive/cuid2";

let mockTasks: any[] = [];
let mockSteps: any[] = [];

vi.mock("drizzle-orm", () => ({
    eq: (col: any, val: any) => ({ __col: col, __val: val, __type: "eq" }),
    and: (...conds: any[]) => ({ __type: "and", conds }),
}));

vi.mock("../../db/index.js", () => {
    const getColKey = (col: any) => {
        if (typeof col === "string") return col;
        const raw = col.name || col.key || col._name || col.columnName || col;
        return raw.replace(/_([a-z])/g, (_: any, l: string) => l.toUpperCase());
    };

    const matchesCond = (item: any, cond: any): boolean => {
        if (!cond) return true;
        if (cond.__type === "eq") {
            const key = getColKey(cond.__col);
            return item[key] === cond.__val;
        }
        if (cond.__type === "and") {
            return (cond.conds || []).every((c: any) => matchesCond(item, c));
        }
        return true;
    };

    const db = {
        transaction: async (cb: any) => cb(db),
        insert: (table: any) => ({
            values: (val: any) => {
                const isStepTable = Boolean(table?.taskId || val?.taskId || (Array.isArray(val) && val[0]?.taskId));
                const store = isStepTable ? mockSteps : mockTasks;
                const arr = Array.isArray(val) ? val : [val];
                const inserted = arr.map((item) => ({
                    id: item.id || createId(),
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    ...item,
                }));
                store.push(...inserted);
                return {
                    returning: async () => inserted,
                    then: (resolve: any, reject: any) => Promise.resolve(inserted).then(resolve, reject),
                };
            },
        }),
        select: () => ({
            from: (table: any) => {
                const isStepTable = Boolean(table?.taskId);
                const store = isStepTable ? mockSteps : mockTasks;

                return {
                    where: (cond: any) => ({
                        limit: async (n: number) => {
                            return store.filter((item) => matchesCond(item, cond)).slice(0, n);
                        },
                        orderBy: async () => {
                            return store.filter((item) => matchesCond(item, cond));
                        },
                        then: (resolve: any, reject: any) =>
                            Promise.resolve(store.filter((item) => matchesCond(item, cond))).then(resolve, reject),
                    }),
                    orderBy: async () => [...store],
                    limit: async (n: number) => [...store].slice(0, n),
                    then: (resolve: any, reject: any) => Promise.resolve([...store]).then(resolve, reject),
                };
            },
        }),
        update: (table: any) => ({
            set: (data: any) => {
                const isStepTable = Boolean(table?.taskId);
                const store = isStepTable ? mockSteps : mockTasks;

                return {
                    where: (cond: any) => {
                        const updated: any[] = [];
                        for (let i = 0; i < store.length; i++) {
                            if (matchesCond(store[i], cond)) {
                                store[i] = { ...store[i], ...data, updatedAt: new Date() };
                                updated.push(store[i]);
                            }
                        }
                        return {
                            returning: async () => updated,
                            then: (resolve: any, reject: any) => Promise.resolve(updated).then(resolve, reject),
                        };
                    },
                };
            },
        }),
        delete: (table: any) => ({
            where: (cond: any) => {
                const isStepTable = Boolean(table?.taskId);
                const store = isStepTable ? mockSteps : mockTasks;
                const removed: any[] = [];
                for (let i = store.length - 1; i >= 0; i--) {
                    if (matchesCond(store[i], cond)) {
                        removed.push(...store.splice(i, 1));
                    }
                }
                return {
                    returning: async () => removed,
                    then: (resolve: any, reject: any) => Promise.resolve(removed).then(resolve, reject),
                };
            },
        }),
    };

    return { db };
});

import { agentService } from "./agent.service.js";
import { agentPlanner } from "./planner.js";

describe("Autonomous Agent Framework (V3 Phase 4)", () => {
    beforeEach(() => {
        mockTasks = [];
        mockSteps = [];
    });

    describe("Agent Step Planner (G38, G39)", () => {
        it("should generate a 3-step execution plan for Auto-Localization agent tasks", async () => {
            const plan = await agentPlanner.generatePlan({
                taskId: "task-loc-1",
                type: "localization",
                goal: "Translate all untranslated articles to es, fr, and de",
            });

            expect(plan).toHaveLength(3);
            expect(plan[0]?.action).toBe("content_get");
            expect(plan[1]?.action).toBe("ai_translate");
            expect(plan[1]?.dependsOn).toContain(plan[0]?.id);
            expect(plan[2]?.action).toBe("content_update");
            expect(plan[2]?.dependsOn).toContain(plan[1]?.id);
        });

        it("should generate a 3-step execution plan for Compliance & ROT Cleanup tasks", async () => {
            const plan = await agentPlanner.generatePlan({
                taskId: "task-comp-1",
                type: "compliance",
                goal: "Audit content graph for Redundant, Obsolete, and Trivial (ROT) entries older than 180 days",
            });

            expect(plan).toHaveLength(3);
            expect(plan[0]?.action).toBe("search_hybrid");
            expect(plan[1]?.action).toBe("ai_summarize");
            expect(plan[2]?.action).toBe("content_update");
        });

        it("should generate a 3-step execution plan for Brand Voice Auditor tasks", async () => {
            const plan = await agentPlanner.generatePlan({
                taskId: "task-brand-1",
                type: "brand-voice",
                goal: "Ensure all draft marketing entries adhere to formal corporate tone",
            });

            expect(plan).toHaveLength(3);
            expect(plan[0]?.action).toBe("content_list");
            expect(plan[1]?.action).toBe("ai_generate");
            expect(plan[2]?.action).toBe("content_update");
        });

        it("should generate a 3-step execution plan for SEO Optimizer tasks", async () => {
            const plan = await agentPlanner.generatePlan({
                taskId: "task-seo-1",
                type: "seo-audit",
                goal: "Generate missing SEO title tags and meta descriptions across blog posts",
            });

            expect(plan).toHaveLength(3);
            expect(plan[0]?.action).toBe("content_list");
            expect(plan[1]?.action).toBe("ai_generate");
            expect(plan[2]?.action).toBe("content_update");
        });
    });

    describe("Agent Task Lifecycle & Autonomous Execution", () => {
        it("should create an autonomous task without human review and execute it to completion", async () => {
            const task = await agentService.createTask({
                type: "localization",
                goal: "Translate onboarding guide to Spanish",
                requiresHumanReview: false,
                createdBy: "admin@rosmarium.cos",
            });

            expect(task.id).toBeDefined();
            expect(task.type).toBe("localization");
            expect(task.plan).toHaveLength(3);

            // Fetch after execution completes
            const completedTask = await agentService.getTaskById(task.id);
            expect(completedTask?.status).toBe("completed");
            expect(completedTask?.results).toHaveLength(3);
            expect(completedTask?.results[0]?.success).toBe(true);
            expect(completedTask?.results[1]?.success).toBe(true);
            expect(completedTask?.results[2]?.success).toBe(true);
        });

        it("should list tasks filtered by status and tenant", async () => {
            await agentService.createTask({
                type: "seo-audit",
                goal: "Fix SEO meta on homepage",
                tenantId: "tenant-acme",
                requiresHumanReview: false,
            });

            await agentService.createTask({
                type: "compliance",
                goal: "Scan legal docs",
                tenantId: "tenant-other",
                requiresHumanReview: true,
            });

            const acmeTasks = await agentService.listTasks({ tenantId: "tenant-acme" });
            expect(acmeTasks).toHaveLength(1);
            expect(acmeTasks[0]?.type).toBe("seo-audit");

            const reviewTasks = await agentService.listTasks({ status: "review" });
            expect(reviewTasks).toHaveLength(1);
            expect(reviewTasks[0]?.type).toBe("compliance");
        });
    });

    describe("Human-in-the-Loop (HITL) Governance Gate", () => {
        it("should gate task execution when requiresHumanReview is true", async () => {
            const task = await agentService.createTask({
                type: "rot-cleanup",
                goal: "Delete obsolete internal memos from 2023",
                requiresHumanReview: true,
            });

            expect(task.status).toBe("review");
            expect(task.results).toHaveLength(0);

            // Verify step records in DB are pending
            const storedTask = await agentService.getTaskById(task.id);
            expect(storedTask?.status).toBe("review");
        });

        it("should resume and complete task execution when human reviewer approves", async () => {
            const task = await agentService.createTask({
                type: "brand-voice",
                goal: "Rewrite casual blog posts into formal executive tone",
                requiresHumanReview: true,
            });

            expect(task.status).toBe("review");

            // Approve review
            const approvedTask = await agentService.approveReview(task.id, true, "Approved by VP of Marketing");
            expect(approvedTask?.status).toBe("completed");
            expect(approvedTask?.results).toHaveLength(3);
        });

        it("should cancel task when human reviewer rejects", async () => {
            const task = await agentService.createTask({
                type: "rot-cleanup",
                goal: "Archive all content older than 30 days",
                requiresHumanReview: true,
            });

            expect(task.status).toBe("review");

            // Reject review
            const rejectedTask = await agentService.approveReview(
                task.id,
                false,
                "Rejected: Policy requires 365 days retention before archiving"
            );
            expect(rejectedTask?.status).toBe("cancelled");
            expect(rejectedTask?.error).toContain("Policy requires 365 days retention");
        });

        it("should allow cancelling a task directly", async () => {
            const task = await agentService.createTask({
                type: "custom",
                goal: "Custom exploration task",
                requiresHumanReview: true,
            });

            const cancelled = await agentService.cancelTask(task.id, "User aborted operation");
            expect(cancelled?.status).toBe("cancelled");
            expect(cancelled?.error).toBe("User aborted operation");
        });
    });
});
