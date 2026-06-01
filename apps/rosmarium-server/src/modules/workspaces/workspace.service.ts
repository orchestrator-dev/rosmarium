/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable prefer-const */
import { db } from "../../db/index.js";
import { workspaces, workspaceMembers } from "../../db/schema/workspaces.js";
import { eq, and } from "drizzle-orm";
import type { UserRole } from "../auth/auth.service.js";

export const workspaceService = {
    async createWorkspace(data: { name: string; slug: string; settings?: unknown }) {
        const [workspace] = await db.insert(workspaces).values({
            name: data.name,
            slug: data.slug,
            settings: data.settings || {},
        }).returning();
        return workspace;
    },

    async getWorkspaces() {
        return db.select().from(workspaces);
    },

    async getWorkspaceById(id: string) {
        const [workspace] = await db.select().from(workspaces).where(eq(workspaces.id, id));
        return workspace;
    },

    async updateWorkspace(id: string, data: { name?: string; slug?: string; settings?: unknown }) {
        const [workspace] = await db.update(workspaces).set({
            ...data,
            updatedAt: new Date()
        }).where(eq(workspaces.id, id)).returning();
        return workspace;
    },

    async deleteWorkspace(id: string) {
        await db.delete(workspaces).where(eq(workspaces.id, id));
    },

    async addMember(workspaceId: string, userId: string, role: UserRole = "viewer") {
        const [member] = await db.insert(workspaceMembers).values({
            workspaceId,
            userId,
            role: (role === "super_admin" ? "admin" : role) as any,
        }).returning();
        return member;
    },

    async updateMemberRole(workspaceId: string, userId: string, role: UserRole) {
        const [member] = await db.update(workspaceMembers).set({
            role: (role === "super_admin" ? "admin" : role) as any,
        }).where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId))).returning();
        return member;
    },

    async removeMember(workspaceId: string, userId: string) {
        await db.delete(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)));
    },

    async getMembers(workspaceId: string) {
        return db.select().from(workspaceMembers).where(eq(workspaceMembers.workspaceId, workspaceId));
    },

    async getMemberRole(workspaceId: string, userId: string): Promise<string | null> {
        const [member] = await db.select().from(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)));
        return member ? member.role : null;
    }
};
