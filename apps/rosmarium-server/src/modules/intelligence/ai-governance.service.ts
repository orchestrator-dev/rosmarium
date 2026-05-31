import { db } from "../../db/index.js";
import { aiOperationsLog } from "../../db/schema/ai-audit.js";
import { tenants } from "../../db/schema/tenants.js";
import { eq, and, gte, sql } from "drizzle-orm";

export interface LogAIOperationParams {
    operationType: string;
    entryId?: string;
    userId?: string;
    tenantId?: string;
    modelProvider?: string;
    modelName?: string;
    inputTokens?: number;
    outputTokens?: number;
    latencyMs?: number;
    status: "success" | "error" | "rejected";
    metadata?: Record<string, unknown>;
}

export const aiGovernanceService = {
    async logOperation(params: LogAIOperationParams) {
        await db.insert(aiOperationsLog).values({
            operationType: params.operationType,
            entryId: params.entryId,
            userId: params.userId,
            tenantId: params.tenantId,
            modelProvider: params.modelProvider,
            modelName: params.modelName,
            inputTokens: params.inputTokens,
            outputTokens: params.outputTokens,
            latencyMs: params.latencyMs,
            status: params.status,
            metadata: params.metadata,
        });
    },

    async checkTenantTokenBudget(tenantId: string) {
        // Find current month's usage
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const result = await db
            .select({
                totalTokens: sql<number>`SUM(COALESCE(${aiOperationsLog.inputTokens}, 0) + COALESCE(${aiOperationsLog.outputTokens}, 0))`,
            })
            .from(aiOperationsLog)
            .where(
                and(
                    eq(aiOperationsLog.tenantId, tenantId),
                    gte(aiOperationsLog.createdAt, startOfMonth)
                )
            );

        const usage = Number(result[0]?.totalTokens) || 0;

        // Get tenant's plan/budget settings
        const tenantData = await db.select({ settings: tenants.settings }).from(tenants).where(eq(tenants.id, tenantId));
        const settings = (tenantData[0]?.settings as Record<string, unknown>) || {};
        const budget = (settings.aiTokenBudget as number) || 1000000; // default 1M tokens

        return {
            usage,
            budget,
            remaining: Math.max(0, budget - usage),
            isExceeded: usage >= budget,
            isWarning: usage >= budget * 0.8,
        };
    },

    async checkUserRateLimit(userId: string) {
        // Basic sliding window or count-based rate limit
        const oneHourAgo = new Date();
        oneHourAgo.setHours(oneHourAgo.getHours() - 1);

        const result = await db
            .select({
                operationsCount: sql<number>`COUNT(*)`,
            })
            .from(aiOperationsLog)
            .where(
                and(
                    eq(aiOperationsLog.userId, userId),
                    gte(aiOperationsLog.createdAt, oneHourAgo)
                )
            );

        const count = Number(result[0]?.operationsCount) || 0;
        const limit = 100; // Configurable per-user limit

        return {
            count,
            limit,
            isExceeded: count >= limit,
        };
    },

    async getDashboardMetrics(tenantId?: string) {
        // Return metrics for the dashboard (mock query to satisfy types/requirements for now)
        const conditions = tenantId ? eq(aiOperationsLog.tenantId, tenantId) : undefined;
        
        const usageStats = await db
            .select({
                operationType: aiOperationsLog.operationType,
                count: sql<number>`COUNT(*)`,
                avgLatency: sql<number>`AVG(${aiOperationsLog.latencyMs})`,
                totalInputTokens: sql<number>`SUM(${aiOperationsLog.inputTokens})`,
                totalOutputTokens: sql<number>`SUM(${aiOperationsLog.outputTokens})`,
            })
            .from(aiOperationsLog)
            .where(conditions)
            .groupBy(aiOperationsLog.operationType);

        return usageStats;
    }
};
