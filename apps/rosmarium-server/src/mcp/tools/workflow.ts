import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { workflowService } from "../../modules/workflow/workflow.service.js";
import { schedulerService } from "../../modules/content/scheduler.service.js";

export const registerWorkflowTools = (server: McpServer) => {
    server.tool(
        "workflow_status",
        "Get workflow transition history for a content entry. Returns all state changes with timestamps, actors, and comments.",
        {
            entryId: z.string().describe("The content entry ID to get workflow history for"),
        },
        async ({ entryId }) => {
            try {
                const history = await workflowService.getHistory(entryId);
                return {
                    content: [{ type: "text", text: JSON.stringify(history, null, 2) }],
                };
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                return {
                    content: [{ type: "text", text: JSON.stringify({ error: message }) }],
                    isError: true,
                };
            }
        }
    );

    server.tool(
        "workflow_transition",
        "Move a content entry to a new workflow state. Validates the transition is allowed and checks required conditions.",
        {
            entryId: z.string().describe("The content entry ID to transition"),
            toState: z.string().describe("The target workflow state (e.g. 'published', 'review', 'draft')"),
            userId: z.string().optional().default("mcp-agent").describe("The user performing the transition"),
            comment: z.string().optional().describe("Optional comment explaining the transition"),
        },
        async ({ entryId, toState, userId, comment }) => {
            try {
                const result = await workflowService.transition(entryId, toState, userId, comment);
                return {
                    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                };
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                return {
                    content: [{ type: "text", text: JSON.stringify({ error: message }) }],
                    isError: true,
                };
            }
        }
    );

    server.tool(
        "workflow_list",
        "List all workflow definitions. Returns workflow names, states, transitions, and which content types they apply to.",
        {},
        async () => {
            try {
                const workflows = await workflowService.getWorkflows();
                return {
                    content: [{ type: "text", text: JSON.stringify(workflows, null, 2) }],
                };
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                return {
                    content: [{ type: "text", text: JSON.stringify({ error: message }) }],
                    isError: true,
                };
            }
        }
    );

    server.tool(
        "schedule_publish",
        "Schedule a future publish or unpublish action for a content entry. The action will be executed at the specified time.",
        {
            entryId: z.string().describe("The content entry ID to schedule"),
            scheduledAt: z.string().describe("ISO 8601 date string for when the action should execute"),
            action: z.enum(["publish", "unpublish"]).optional().default("publish").describe("The action to schedule"),
            userId: z.string().optional().default("mcp-agent").describe("The user scheduling the action"),
            contentTypeName: z.string().describe("The content type name of the entry"),
        },
        async ({ entryId, scheduledAt, action, userId, contentTypeName }) => {
            try {
                const scheduledDate = new Date(scheduledAt);
                if (isNaN(scheduledDate.getTime())) {
                    return {
                        content: [{ type: "text", text: JSON.stringify({ error: "Invalid date format. Use ISO 8601 (e.g. '2025-01-15T10:00:00Z')." }) }],
                        isError: true,
                    };
                }

                const jobId = await schedulerService.scheduleAction(entryId, action, scheduledDate, userId, contentTypeName);
                return {
                    content: [{ type: "text", text: JSON.stringify({ success: true, jobId, scheduledAt: scheduledDate.toISOString(), action }) }],
                };
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                return {
                    content: [{ type: "text", text: JSON.stringify({ error: message }) }],
                    isError: true,
                };
            }
        }
    );

    server.tool(
        "schedule_cancel",
        "Cancel a previously scheduled publish or unpublish action for a content entry.",
        {
            entryId: z.string().describe("The content entry ID to cancel the schedule for"),
            action: z.enum(["publish", "unpublish"]).describe("The scheduled action to cancel"),
        },
        async ({ entryId, action }) => {
            try {
                await schedulerService.cancelScheduled(entryId, action);
                return {
                    content: [{ type: "text", text: JSON.stringify({ success: true, entryId, cancelledAction: action }) }],
                };
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                return {
                    content: [{ type: "text", text: JSON.stringify({ error: message }) }],
                    isError: true,
                };
            }
        }
    );

    server.tool(
        "schedule_list",
        "List all scheduled jobs (publish/unpublish) for a content entry. Shows pending actions with their scheduled times.",
        {
            entryId: z.string().describe("The content entry ID to list scheduled jobs for"),
        },
        async ({ entryId }) => {
            try {
                const jobs = await schedulerService.getScheduledJobs(entryId);
                return {
                    content: [{ type: "text", text: JSON.stringify(jobs, null, 2) }],
                };
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                return {
                    content: [{ type: "text", text: JSON.stringify({ error: message }) }],
                    isError: true,
                };
            }
        }
    );
};
