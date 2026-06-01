/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable prefer-const */
import { FastifyInstance } from "fastify";
import { workspaceService } from "./workspace.service.js";
import { requireAuth, requireRole } from "../rbac/rbac.middleware.js";

export async function workspaceRoutes(app: FastifyInstance) {
    app.post("/", { preHandler: [requireAuth(), requireRole("admin", "super_admin")] }, async (request, reply) => {
        const data = request.body as any;
        return workspaceService.createWorkspace(data);
    });

    app.get("/", { preHandler: [requireAuth()] }, async (request, reply) => {
        return workspaceService.getWorkspaces();
    });

    app.get("/:id", { preHandler: [requireAuth()] }, async (request, reply) => {
        const { id } = request.params as any;
        const workspace = await workspaceService.getWorkspaceById(id);
        if (!workspace) {
            return reply.status(404).send({ error: "Workspace not found" });
        }
        return workspace;
    });

    app.put("/:id", { preHandler: [requireAuth(), requireRole("admin", "super_admin")] }, async (request, reply) => {
        const { id } = request.params as any;
        const data = request.body as any;
        return workspaceService.updateWorkspace(id, data);
    });

    app.delete("/:id", { preHandler: [requireAuth(), requireRole("admin", "super_admin")] }, async (request, reply) => {
        const { id } = request.params as any;
        await workspaceService.deleteWorkspace(id);
        return { success: true };
    });

    app.post("/:id/members", { preHandler: [requireAuth(), requireRole("admin", "super_admin")] }, async (request, reply) => {
        const { id } = request.params as any;
        const { userId, role } = request.body as any;
        return workspaceService.addMember(id, userId, role);
    });

    app.put("/:id/members/:userId", { preHandler: [requireAuth(), requireRole("admin", "super_admin")] }, async (request, reply) => {
        const { id, userId } = request.params as any;
        const { role } = request.body as any;
        return workspaceService.updateMemberRole(id, userId, role);
    });

    app.delete("/:id/members/:userId", { preHandler: [requireAuth(), requireRole("admin", "super_admin")] }, async (request, reply) => {
        const { id, userId } = request.params as any;
        await workspaceService.removeMember(id, userId);
        return { success: true };
    });

    app.get("/:id/members", { preHandler: [requireAuth()] }, async (request, reply) => {
        const { id } = request.params as any;
        return workspaceService.getMembers(id);
    });
}
