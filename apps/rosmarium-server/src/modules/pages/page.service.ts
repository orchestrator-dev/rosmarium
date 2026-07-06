import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { pages, pageSections } from "../../db/schema/pages.js";
import { PageDefinition, PageSection } from "@orchestrator.dev/types";

export const pageService = {
    async createPage(data: Omit<PageDefinition, "id" | "sections"> & { sections?: Omit<PageSection, "id">[] }) {
        return await db.transaction(async (tx) => {
            const [page] = await tx
                .insert(pages)
                .values({
                    slug: data.slug,
                    title: data.title,
                    locale: data.locale,
                    template: data.template,
                    seo: data.seo as any,
                    personalization: data.personalization as any,
                })
                .returning();

            if (!page) throw new Error("Page not found");
            if (data.sections && data.sections.length > 0) {
                await tx.insert(pageSections).values(
                    data.sections.map((section, index) => ({
                        pageId: page.id,
                        componentId: section.componentId,
                        props: section.props as any,
                        conditions: section.conditions as any,
                        order: section.order ?? index,
                    }))
                );
            }

            return this.getPageById(page.id, tx);
        });
    },

    async getPages() {
        return db.select().from(pages).orderBy(pages.createdAt);
    },

    async getPageById(id: string, tx: any = db) {
        const [page] = await tx.select().from(pages).where(eq(pages.id, id)).limit(1);
        if (!page) return null;

        const sections = await tx
            .select()
            .from(pageSections)
            .where(eq(pageSections.pageId, page.id))
            .orderBy(pageSections.order);

        return { ...page, sections };
    },

    async getPageBySlug(slug: string) {
        const [page] = await db.select().from(pages).where(eq(pages.slug, slug)).limit(1);
        if (!page) return null;

        const sections = await db
            .select()
            .from(pageSections)
            .where(eq(pageSections.pageId, page.id))
            .orderBy(pageSections.order);

        return { ...page, sections };
    },

    async updatePage(id: string, data: Partial<PageDefinition>) {
        return await db.transaction(async (tx) => {
            if (data.slug || data.title || data.locale || data.template || data.seo || data.personalization) {
                await tx
                    .update(pages)
                    .set({
                        slug: data.slug,
                        title: data.title,
                        locale: data.locale,
                        template: data.template,
                        seo: data.seo as any,
                        personalization: data.personalization as any,
                        updatedAt: new Date(),
                    })
                    .where(eq(pages.id, id));
            }

            if (data.sections) {
                // Simplistic replacement approach for sections
                await tx.delete(pageSections).where(eq(pageSections.pageId, id));
                if (data.sections.length > 0) {
                    await tx.insert(pageSections).values(
                        data.sections.map((section, index) => ({
                            pageId: id,
                            componentId: section.componentId,
                            props: section.props as any,
                            conditions: section.conditions as any,
                            order: section.order ?? index,
                        }))
                    );
                }
            }

            return this.getPageById(id, tx);
        });
    },

    async deletePage(id: string) {
        const [result] = await db.delete(pages).where(eq(pages.id, id)).returning();
        return result;
    }
};
