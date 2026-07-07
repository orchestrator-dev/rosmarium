import { createId } from "@paralleldrive/cuid2";
import type { AgentTaskType, AgentStep } from "@orchestrator.dev/types";

export interface PlannerInput {
    taskId: string;
    type: AgentTaskType;
    goal: string;
    context?: Record<string, unknown>;
}

export const agentPlanner = {
    /**
     * Generates an autonomous multi-step execution plan based on task type and natural language goal.
     * In a production AI-native environment, this invokes LLM reasoning / MCP planning tools.
     * Here we implement intelligent heuristic & rule-based planning for built-in enterprise agents.
     */
    async generatePlan(input: PlannerInput): Promise<AgentStep[]> {
        const { type, goal } = input;
        const steps: AgentStep[] = [];

        if (type === "localization") {
            const step1Id = createId();
            const step2Id = createId();
            const step3Id = createId();

            steps.push({
                id: step1Id,
                action: "content_get",
                args: { query: goal, filter: "untranslated" },
                status: "pending",
            });

            steps.push({
                id: step2Id,
                action: "ai_translate",
                args: {
                    sourceStepId: step1Id,
                    targetLocales: ["es", "fr", "de"],
                    preserveFormatting: true,
                },
                dependsOn: [step1Id],
                status: "pending",
            });

            steps.push({
                id: step3Id,
                action: "content_update",
                args: {
                    sourceStepId: step2Id,
                    publish: false,
                    workflowState: "in-review",
                },
                dependsOn: [step2Id],
                status: "pending",
            });
        } else if (type === "compliance" || type === "rot-cleanup") {
            const step1Id = createId();
            const step2Id = createId();
            const step3Id = createId();

            steps.push({
                id: step1Id,
                action: "search_hybrid",
                args: { query: goal, freshnessOlderThanDays: 180 },
                status: "pending",
            });

            steps.push({
                id: step2Id,
                action: "ai_summarize",
                args: {
                    sourceStepId: step1Id,
                    focus: "ROT (Redundant, Obsolete, Trivial) detection and compliance audit",
                },
                dependsOn: [step1Id],
                status: "pending",
            });

            steps.push({
                id: step3Id,
                action: "content_update",
                args: {
                    sourceStepId: step2Id,
                    tagAs: "flagged-rot",
                    notifyOwners: true,
                },
                dependsOn: [step2Id],
                status: "pending",
            });
        } else if (type === "brand-voice") {
            const step1Id = createId();
            const step2Id = createId();
            const step3Id = createId();

            steps.push({
                id: step1Id,
                action: "content_list",
                args: { limit: 50, status: "draft" },
                status: "pending",
            });

            steps.push({
                id: step2Id,
                action: "ai_generate",
                args: {
                    prompt: `Audit content against brand voice guidelines: ${goal}`,
                    evaluationMode: true,
                    sourceStepId: step1Id,
                },
                dependsOn: [step1Id],
                status: "pending",
            });

            steps.push({
                id: step3Id,
                action: "content_update",
                args: {
                    sourceStepId: step2Id,
                    applyCorrections: true,
                    auditNote: "Automated brand voice alignment",
                },
                dependsOn: [step2Id],
                status: "pending",
            });
        } else if (type === "seo-audit") {
            const step1Id = createId();
            const step2Id = createId();
            const step3Id = createId();

            steps.push({
                id: step1Id,
                action: "content_list",
                args: { missingSeo: true, limit: 100 },
                status: "pending",
            });

            steps.push({
                id: step2Id,
                action: "ai_generate",
                args: {
                    prompt: `Generate optimized SEO title tags and meta descriptions: ${goal}`,
                    targetFields: ["seoTitle", "seoDescription"],
                    sourceStepId: step1Id,
                },
                dependsOn: [step1Id],
                status: "pending",
            });

            steps.push({
                id: step3Id,
                action: "content_update",
                args: {
                    sourceStepId: step2Id,
                    updateSeoMeta: true,
                },
                dependsOn: [step2Id],
                status: "pending",
            });
        } else {
            // Custom agent task
            const step1Id = createId();
            const step2Id = createId();

            steps.push({
                id: step1Id,
                action: "search_hybrid",
                args: { query: goal },
                status: "pending",
            });

            steps.push({
                id: step2Id,
                action: "ai_generate",
                args: { prompt: goal, sourceStepId: step1Id },
                dependsOn: [step1Id],
                status: "pending",
            });
        }

        return steps;
    },
};
