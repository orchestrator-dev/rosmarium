import { eq, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { contentTemplates } from "../../db/schema/index.js";

export interface Template {
    id: string;
    name: string;
    description: string | null;
    contentTypeId: string | null;
    templateData: Record<string, unknown>;
    isGlobal: boolean | null;
    createdBy: string | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface CreateTemplateOpts {
    name: string;
    description?: string;
    contentTypeId?: string;
    templateData: Record<string, unknown>;
    isGlobal?: boolean;
    createdBy?: string;
}

export interface UpdateTemplateOpts {
    name?: string;
    description?: string;
    templateData?: Record<string, unknown>;
    isGlobal?: boolean;
}

export const templatesService = {
    async create(opts: CreateTemplateOpts): Promise<Template> {
        const [template] = await db
            .insert(contentTemplates)
            .values({
                name: opts.name,
                description: opts.description ?? null,
                contentTypeId: opts.contentTypeId ?? null,
                templateData: opts.templateData,
                isGlobal: opts.isGlobal ?? false,
                createdBy: opts.createdBy ?? null,
            })
            .returning();
        if (!template) throw new Error("Failed to create template");
        return template as Template;
    },

    async update(id: string, opts: UpdateTemplateOpts): Promise<Template> {
        const updateData: Partial<typeof contentTemplates.$inferInsert> = {};
        if (opts.name !== undefined) updateData.name = opts.name;
        if (opts.description !== undefined) updateData.description = opts.description;
        if (opts.templateData !== undefined) updateData.templateData = opts.templateData;
        if (opts.isGlobal !== undefined) updateData.isGlobal = opts.isGlobal;
        updateData.updatedAt = new Date();

        const [template] = await db
            .update(contentTemplates)
            .set(updateData)
            .where(eq(contentTemplates.id, id))
            .returning();

        if (!template) throw new Error("Template not found");
        return template as Template;
    },

    async delete(id: string): Promise<boolean> {
        const [result] = await db.delete(contentTemplates).where(eq(contentTemplates.id, id)).returning({ id: contentTemplates.id });
        return !!result;
    },

    async getById(id: string): Promise<Template | null> {
        const [template] = await db.select().from(contentTemplates).where(eq(contentTemplates.id, id));
        return (template as Template) ?? null;
    },

    async list(contentTypeId?: string): Promise<Template[]> {
        let query = db.select().from(contentTemplates).$dynamic();
        
        // If a content type is provided, return global templates AND scoped templates for this type
        if (contentTypeId) {
            query = query.where(
                sql`${contentTemplates.isGlobal} = true OR ${contentTemplates.contentTypeId} = ${contentTypeId}`
            );
        }

        const results = await query;
        return results as Template[];
    }
};
