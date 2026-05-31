/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, @typescript-eslint/ban-ts-comment */
import { Type } from "@sinclair/typebox";
import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { presenceService, PresenceUser } from "./presence.service.js";

export const presenceRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
    fastify.get("/:entryId/presence", { websocket: true }, (connection, req) => {
        const entryId = (req.params as any).entryId;
        // In real app we would get the user from `req.user`
        // For simplicity, they might pass token or we extract it, but let's assume auth is handled or we expect it in the first message.
        let currentUser: PresenceUser | null = null;

        // Subscribe to redis updates
        const subClient = presenceService.subscribeToUpdates(entryId, (message) => {
            connection.send(message);
        });

        connection.on("message", async (message: Buffer) => {
            try {
                const data = JSON.parse(message.toString());

                if (data.type === "join") {
                    currentUser = {
                        userId: data.userId,
                        name: data.name,
                        avatarUrl: data.avatarUrl,
                        lastActive: Date.now()
                    };
                    await presenceService.heartbeat(entryId, currentUser);
                } else if (data.type === "heartbeat" && currentUser) {
                    await presenceService.heartbeat(entryId, currentUser);
                } else if (data.type === "lock" && currentUser) {
                    await presenceService.lockField(entryId, data.fieldId, currentUser);
                } else if (data.type === "unlock" && currentUser) {
                    await presenceService.unlockField(entryId, currentUser.userId);
                }
            } catch (err) {
                console.error("Invalid WS message:", err);
            }
        });

        connection.on("close", async () => {
            subClient.disconnect();
            if (currentUser) {
                await presenceService.leave(entryId, currentUser.userId);
            }
        });
    });

    fastify.get("/:entryId/active", async (req) => {
        const entryId = (req.params as any).entryId;
        return presenceService.getActiveUsers(entryId);
    });
};
