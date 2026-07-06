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
};
