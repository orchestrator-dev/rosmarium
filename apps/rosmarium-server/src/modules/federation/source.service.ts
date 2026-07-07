import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { remoteSources } from "../../db/schema/index.js";
import type { RemoteSourceModel, NewRemoteSourceModel } from "../../db/schema/index.js";

export const sourceService = {
    async createSource(data: typeof remoteSources.$inferInsert) {
        const [source] = await db.insert(remoteSources).values(data).returning();
        return source;
    },

    async getSource(id: string) {
        const source = await db.query.remoteSources.findFirst({
            where: eq(remoteSources.id, id),
        });
        return source;
    },

    async listSources(): Promise<RemoteSourceModel[]> {
        return db.query.remoteSources.findMany({
            orderBy: (rs, { asc }) => [asc(rs.name)],
        });
    },

    async updateSource(id: string, data: Partial<typeof remoteSources.$inferInsert>) {
        const [source] = await db
            .update(remoteSources)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(remoteSources.id, id))
            .returning();
        return source;
    },

    async deleteSource(id: string): Promise<void> {
        await db.delete(remoteSources).where(eq(remoteSources.id, id));
    },

    async checkHealth(id: string): Promise<{ healthy: boolean; status: string; message?: string }> {
        const source = await this.getSource(id);
        if (!source) {
            return { healthy: false, status: "error", message: "Source not found" };
        }

        const url = source.healthCheckUrl || source.endpoint;
        const headers: Record<string, string> = {};

        if (source.authConfig && typeof source.authConfig === "object") {
            const auth = source.authConfig as Record<string, unknown>;
            if (auth["type"] === "bearer" && typeof auth["token"] === "string") {
                headers["Authorization"] = `Bearer ${auth["token"]}`;
            } else if (auth["type"] === "apiKey" && typeof auth["header"] === "string" && typeof auth["key"] === "string") {
                headers[auth["header"]] = auth["key"];
            }
        }

        try {
            const res = await fetch(url, { method: "GET", headers });
            const healthy = res.status < 400 || res.status === 405; // 405 Method Not Allowed is fine if endpoint only accepts POST (e.g. GraphQL)
            const statusStr = healthy ? "healthy" : "unhealthy";
            const message = healthy ? `Connection successful (HTTP ${res.status})` : `Connection failed with HTTP status ${res.status}`;

            await db
                .update(remoteSources)
                .set({
                    lastHealthCheck: new Date(),
                    lastHealthStatus: statusStr,
                    status: healthy ? "active" : "error",
                    updatedAt: new Date(),
                })
                .where(eq(remoteSources.id, id));

            return { healthy, status: statusStr, message };
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : "Network request failed";
            await db
                .update(remoteSources)
                .set({
                    lastHealthCheck: new Date(),
                    lastHealthStatus: "unhealthy",
                    status: "error",
                    updatedAt: new Date(),
                })
                .where(eq(remoteSources.id, id));

            return { healthy: false, status: "error", message: errorMsg };
        }
    },
};
