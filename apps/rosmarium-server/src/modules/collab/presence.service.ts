import Redis from "ioredis";
import { config } from "../../config.js";

const redis = new Redis(config.REDIS_URL);

export interface PresenceUser {
    userId: string;
    name: string;
    avatarUrl?: string;
    fieldId?: string; // which field they are currently focused on
    lastActive: number;
}

export const presenceService = {
    // Keep user active on an entry (heartbeat)
    async heartbeat(entryId: string, user: PresenceUser) {
        user.lastActive = Date.now();
        // Use a Redis Hash to store users per entry. key: presence:{entryId}, field: userId, value: PresenceUser
        await redis.hset(`presence:${entryId}`, user.userId, JSON.stringify(user));
        // Set an expiration for the entire hash. Usually, we'd clean up individual fields via a cron, 
        // but for simplicity, we can just fetch all and filter out stale users.
        await redis.expire(`presence:${entryId}`, 60); 

        // Publish presence update to listeners
        await redis.publish(`presence_updates:${entryId}`, JSON.stringify({ action: "heartbeat", user }));
    },

    // Get all currently active users on an entry
    async getActiveUsers(entryId: string): Promise<PresenceUser[]> {
        const usersMap = await redis.hgetall(`presence:${entryId}`);
        const now = Date.now();
        const activeUsers: PresenceUser[] = [];
        const staleUserIds: string[] = [];

        for (const [userId, userStr] of Object.entries(usersMap)) {
            const user: PresenceUser = JSON.parse(userStr);
            // 30 second threshold for stale users
            if (now - user.lastActive > 30000) {
                staleUserIds.push(userId);
            } else {
                activeUsers.push(user);
            }
        }

        if (staleUserIds.length > 0) {
            await redis.hdel(`presence:${entryId}`, ...staleUserIds);
        }

        return activeUsers;
    },

    // Explicit leave
    async leave(entryId: string, userId: string) {
        await redis.hdel(`presence:${entryId}`, userId);
        await redis.publish(`presence_updates:${entryId}`, JSON.stringify({ action: "leave", userId }));
    },

    // Lock a field (soft lock)
    async lockField(entryId: string, fieldId: string, user: PresenceUser) {
        user.fieldId = fieldId;
        await this.heartbeat(entryId, user);
    },

    // Unlock a field
    async unlockField(entryId: string, userId: string) {
        const userStr = await redis.hget(`presence:${entryId}`, userId);
        if (userStr) {
            const user: PresenceUser = JSON.parse(userStr);
            user.fieldId = undefined;
            await this.heartbeat(entryId, user);
        }
    },

    // Subscribe to presence updates for an entry (for WebSocket use)
    subscribeToUpdates(entryId: string, callback: (message: string) => void) {
        const subClient = new Redis(config.REDIS_URL);
        subClient.subscribe(`presence_updates:${entryId}`);
        subClient.on("message", (channel, message) => {
            if (channel === `presence_updates:${entryId}`) {
                callback(message);
            }
        });
        return subClient; // return client so we can disconnect later
    }
};
