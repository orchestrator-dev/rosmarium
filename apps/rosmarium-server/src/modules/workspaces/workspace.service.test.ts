import { expect, test, describe, beforeAll, afterAll } from "vitest";
import { workspaceService } from "./workspace.service.js";
import { db } from "../../db/index.js";
import { users } from "../../db/schema/users.js";
import { eq } from "drizzle-orm";

describe("Workspace Service", () => {
    let testUserId: string;
    let testWorkspaceId: string;

    beforeAll(async () => {
        const [u] = await db.insert(users).values({ email: "wstest@example.com", role: "admin" }).returning();
        testUserId = u.id;
    });

    afterAll(async () => {
        await db.delete(users).where(eq(users.id, testUserId));
    });

    test("should create a workspace", async () => {
        const ws = await workspaceService.createWorkspace({ name: "Test WS", slug: "test-ws" });
        expect(ws.id).toBeDefined();
        testWorkspaceId = ws.id;
    });

    test("should list workspaces", async () => {
        const wss = await workspaceService.getWorkspaces();
        expect(wss.length).toBeGreaterThan(0);
    });

    test("should get workspace by id", async () => {
        const ws = await workspaceService.getWorkspaceById(testWorkspaceId);
        expect(ws?.name).toBe("Test WS");
    });

    test("should add member", async () => {
        const member = await workspaceService.addMember(testWorkspaceId, testUserId, "editor");
        expect(member.role).toBe("editor");
    });

    test("should get member role", async () => {
        const role = await workspaceService.getMemberRole(testWorkspaceId, testUserId);
        expect(role).toBe("editor");
    });

    test("should list members", async () => {
        const members = await workspaceService.getMembers(testWorkspaceId);
        expect(members.length).toBe(1);
    });

    test("should update member role", async () => {
        await workspaceService.updateMemberRole(testWorkspaceId, testUserId, "admin");
        const role = await workspaceService.getMemberRole(testWorkspaceId, testUserId);
        expect(role).toBe("admin");
    });

    test("should remove member", async () => {
        await workspaceService.removeMember(testWorkspaceId, testUserId);
        const role = await workspaceService.getMemberRole(testWorkspaceId, testUserId);
        expect(role).toBeNull();
    });

    test("should update workspace", async () => {
        await workspaceService.updateWorkspace(testWorkspaceId, { name: "Updated WS" });
        const ws = await workspaceService.getWorkspaceById(testWorkspaceId);
        expect(ws?.name).toBe("Updated WS");
    });

    test("should delete workspace", async () => {
        await workspaceService.deleteWorkspace(testWorkspaceId);
        const ws = await workspaceService.getWorkspaceById(testWorkspaceId);
        expect(ws).toBeUndefined();
    });
});
