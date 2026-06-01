/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable prefer-const */
import { FastifyInstance } from "fastify";
import { db } from "../../db/index.js";
import { auditLog } from "../../db/schema/audit-log.js";
import { requireAuth, requireRole } from "../rbac/rbac.middleware.js";
import { desc, and, eq, gte, lte } from "drizzle-orm";

export async function auditRoutes(app: FastifyInstance) {
    app.get("/", { preHandler: [requireAuth(), requireRole("admin", "super_admin")] }, async (request, reply) => {
        const query = request.query as any;
        const limit = query.limit ? parseInt(query.limit) : 50;
        const offset = query.offset ? parseInt(query.offset) : 0;
        
        const conditions = [];
        if (query.userId) conditions.push(eq(auditLog.userId, query.userId));
        if (query.action) conditions.push(eq(auditLog.action, query.action));
        if (query.resourceId) conditions.push(eq(auditLog.resourceId, query.resourceId));
        if (query.startDate) conditions.push(gte(auditLog.createdAt, new Date(query.startDate)));
        if (query.endDate) conditions.push(lte(auditLog.createdAt, new Date(query.endDate)));

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        const logs = await db.select()
            .from(auditLog)
            .where(whereClause)
            .orderBy(desc(auditLog.createdAt))
            .limit(limit)
            .offset(offset);

        return logs;
    });

    app.get("/export", { preHandler: [requireAuth(), requireRole("admin", "super_admin")] }, async (request, reply) => {
        const query = request.query as any;
        
        const conditions = [];
        if (query.userId) conditions.push(eq(auditLog.userId, query.userId));
        if (query.action) conditions.push(eq(auditLog.action, query.action));
        if (query.resourceId) conditions.push(eq(auditLog.resourceId, query.resourceId));
        
        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        const logs = await db.select()
            .from(auditLog)
            .where(whereClause)
            .orderBy(desc(auditLog.createdAt));

        const format = query.format || "json";

        if (format === "csv") {
            const header = "id,userId,action,resourceId,createdAt\n";
            const rows = logs.map(l => `${l.id},${l.userId || ""},${l.action},${l.resourceId || ""},${l.createdAt.toISOString()}`).join("\n");
            reply.header("Content-Type", "text/csv");
            reply.header("Content-Disposition", 'attachment; filename="audit-export.csv"');
            return header + rows;
        }

        reply.header("Content-Disposition", 'attachment; filename="audit-export.json"');
        return logs;
    });
}
