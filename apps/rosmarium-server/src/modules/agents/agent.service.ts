import { eq, and } from "drizzle-orm";
import { db } from "../../db/index.js";
import { agentTasks, agentSteps } from "../../db/schema/agent-tasks.js";
import type { AgentTask, AgentStep, CreateAgentTaskInput, AgentTaskStatus } from "@orchestrator.dev/types";
import { agentPlanner } from "./planner.js";
import { agentExecutor } from "./executor.js";

export const agentService = {
    /**
     * Creates a new autonomous agent task, generates an AI execution plan,
     * and either triggers execution or gates it for human-in-the-loop review.
     */
    async createTask(input: CreateAgentTaskInput): Promise<AgentTask> {
        const tenantId = input.tenantId || "default";
        const createdBy = input.createdBy || "system";
        const requiresHumanReview = Boolean(input.requiresHumanReview);
        const initialStatus: AgentTaskStatus = requiresHumanReview ? "review" : "pending";

        // Insert task record
        const [taskRecord] = await db
            .insert(agentTasks)
            .values({
                type: input.type,
                goal: input.goal,
                status: initialStatus,
                requiresHumanReview,
                tenantId,
                createdBy,
                plan: [],
                results: [],
            })
            .returning();

        if (!taskRecord) {
            throw new Error("Failed to create agent task");
        }

        // Generate autonomous plan
        const plan = await agentPlanner.generatePlan({
            taskId: taskRecord.id,
            type: input.type,
            goal: input.goal,
        });

        // Insert steps into db
        if (plan.length > 0) {
            await db.insert(agentSteps).values(
                plan.map((step) => ({
                    id: step.id,
                    taskId: taskRecord.id,
                    action: step.action,
                    args: step.args as Record<string, unknown>,
                    dependsOn: step.dependsOn || [],
                    status: step.status,
                }))
            );
        }

        // Update task with generated plan
        const [updatedTask] = await db
            .update(agentTasks)
            .set({
                plan: plan as unknown as Record<string, unknown>,
                updatedAt: new Date(),
            })
            .where(eq(agentTasks.id, taskRecord.id))
            .returning();

        const resultTask = (updatedTask || taskRecord) as unknown as AgentTask;

        // If no review required, execute immediately
        if (!requiresHumanReview) {
            return (await this.executeTask(resultTask.id)) || resultTask;
        }

        return resultTask;
    },

    async getTaskById(id: string): Promise<AgentTask | null> {
        const [task] = await db.select().from(agentTasks).where(eq(agentTasks.id, id)).limit(1);
        return (task as unknown as AgentTask) || null;
    },

    async listTasks(filter?: { tenantId?: string; status?: string; type?: string }): Promise<AgentTask[]> {
        let query = db.select().from(agentTasks);
        const conditions = [];

        if (filter?.tenantId) {
            conditions.push(eq(agentTasks.tenantId, filter.tenantId));
        }
        if (filter?.status) {
            conditions.push(eq(agentTasks.status, filter.status));
        }
        if (filter?.type) {
            conditions.push(eq(agentTasks.type, filter.type));
        }

        if (conditions.length > 0) {
            query = query.where(and(...conditions)) as unknown as typeof query;
        }

        const results = await query.orderBy(agentTasks.createdAt);
        return results as unknown as AgentTask[];
    },

    /**
     * Executes all steps in an agent task plan sequentially, resolving dependencies
     * and recording step telemetry and outputs.
     */
    async executeTask(taskId: string): Promise<AgentTask | null> {
        const task = await this.getTaskById(taskId);
        if (!task || task.status === "completed" || task.status === "cancelled") {
            return task;
        }

        await db
            .update(agentTasks)
            .set({
                status: "executing",
                startedAt: new Date(),
                updatedAt: new Date(),
            })
            .where(eq(agentTasks.id, taskId));

        const plan = (task.plan || []) as AgentStep[];
        const results = [...(task.results || [])];
        const previousResults = new Map<string, unknown>();

        // Populate existing results if resuming
        for (const res of results) {
            previousResults.set(res.stepId, res.output);
        }

        let hasFailure = false;
        let lastError: string | undefined = undefined;

        for (const step of plan) {
            if (step.status === "completed" || step.status === "skipped") {
                continue;
            }

            // Check if dependencies failed
            const depsFailed = (step.dependsOn || []).some((depId) => {
                const depStep = plan.find((s) => s.id === depId);
                return depStep && depStep.status === "failed";
            });

            if (depsFailed) {
                step.status = "skipped";
                step.error = "Skipped due to dependency failure";
                await db
                    .update(agentSteps)
                    .set({ status: "skipped", error: step.error, updatedAt: new Date() })
                    .where(eq(agentSteps.id, step.id));
                continue;
            }

            const stepResult = await agentExecutor.executeStep(step, {
                taskId,
                tenantId: task.tenantId,
                previousResults,
            });

            results.push(stepResult);

            // Update step record in DB
            await db
                .update(agentSteps)
                .set({
                    status: step.status,
                    result: stepResult.output as Record<string, unknown>,
                    error: stepResult.error,
                    startedAt: step.startedAt instanceof Date ? step.startedAt : new Date(),
                    completedAt: step.completedAt instanceof Date ? step.completedAt : new Date(),
                    updatedAt: new Date(),
                })
                .where(eq(agentSteps.id, step.id));

            if (stepResult.success) {
                previousResults.set(step.id, stepResult.output);
            } else {
                hasFailure = true;
                lastError = stepResult.error;
                break;
            }
        }

        const finalStatus: AgentTaskStatus = hasFailure ? "failed" : "completed";
        const [updatedTask] = await db
            .update(agentTasks)
            .set({
                status: finalStatus,
                plan: plan as unknown as Record<string, unknown>,
                results: results as unknown as Record<string, unknown>,
                completedAt: new Date(),
                error: lastError,
                updatedAt: new Date(),
            })
            .where(eq(agentTasks.id, taskId))
            .returning();

        return (updatedTask as unknown as AgentTask) || null;
    },

    /**
     * Human-In-The-Loop (HITL) Governance Gate:
     * Approves or rejects a task that is waiting in 'review' status.
     */
    async approveReview(taskId: string, approved: boolean, note?: string): Promise<AgentTask | null> {
        const task = await this.getTaskById(taskId);
        if (!task || task.status !== "review") {
            throw new Error(`Task '${taskId}' is not in review status`);
        }

        if (approved) {
            await db
                .update(agentTasks)
                .set({
                    status: "pending",
                    updatedAt: new Date(),
                })
                .where(eq(agentTasks.id, taskId));

            return this.executeTask(taskId);
        } else {
            const [cancelledTask] = await db
                .update(agentTasks)
                .set({
                    status: "cancelled",
                    error: note || "Rejected by human reviewer",
                    completedAt: new Date(),
                    updatedAt: new Date(),
                })
                .where(eq(agentTasks.id, taskId))
                .returning();

            return (cancelledTask as unknown as AgentTask) || null;
        }
    },

    async cancelTask(taskId: string, reason?: string): Promise<AgentTask | null> {
        const [cancelled] = await db
            .update(agentTasks)
            .set({
                status: "cancelled",
                error: reason || "Cancelled by user",
                completedAt: new Date(),
                updatedAt: new Date(),
            })
            .where(eq(agentTasks.id, taskId))
            .returning();

        return (cancelled as unknown as AgentTask) || null;
    },
};
