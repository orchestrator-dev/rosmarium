import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { components } from "../../db/schema/pages.js";
import { ComponentDefinition } from "@orchestrator.dev/types";

export const componentService = {
    async registerComponent(data: Omit<ComponentDefinition, "id">) {
        const [result] = await db
            .insert(components)
            .values({
                name: data.name,
                category: data.category,
                description: data.description,
                thumbnail: data.thumbnail,
                props: data.props as any,
                defaultProps: data.defaultProps as any,
                variants: data.variants as any,
                framework: data.framework,
                source: data.source,
            })
            .returning();
        return result;
    },

    async getComponents() {
        return db.select().from(components).orderBy(components.name);
    },

    async getComponentById(id: string) {
        const [result] = await db.select().from(components).where(eq(components.id, id)).limit(1);
        return result;
    },

    async getComponentsByCategory(category: string) {
        return db.select().from(components).where(eq(components.category, category)).orderBy(components.name);
    },

    async updateComponent(id: string, data: Partial<ComponentDefinition>) {
        const [result] = await db
            .update(components)
            .set({
                ...data,
                props: data.props as any,
                defaultProps: data.defaultProps as any,
                variants: data.variants as any,
                updatedAt: new Date(),
            })
            .where(eq(components.id, id))
            .returning();
        return result;
    },

    async deleteComponent(id: string) {
        const [result] = await db.delete(components).where(eq(components.id, id)).returning();
        return result;
    }
};
