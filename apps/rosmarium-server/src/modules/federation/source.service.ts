import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { remoteSources } from "../../db/schema/index.js";
import type { RemoteSourceModel, NewRemoteSourceModel } from "../../db/schema/index.js";

export const sourceService = {
    async createSource(data: NewRemoteSourceModel): Promise<RemoteSourceModel> {
        const [source] = await db
            .insert(remoteSources)
            .values(data)
            .returning();
        return source;
    },

    async getSource(id: string): Promise<RemoteSourceModel | undefined> {
        return db.query.remoteSources.findFirst({
            where: (rs, { eq }) => eq(rs.id, id),
        });
    },

    async listSources(): Promise<RemoteSourceModel[]> {
        return db.query.remoteSources.findMany({
            orderBy: (rs, { asc }) => [asc(rs.name)],
        });
    },

    async updateSource(id: string, data: Partial<NewRemoteSourceModel>): Promise<RemoteSourceModel> {
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
