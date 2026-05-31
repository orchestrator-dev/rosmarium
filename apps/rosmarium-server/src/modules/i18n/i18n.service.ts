import { db } from "../../db/index.js";
import { locales, Locale, NewLocale } from "../../db/schema/locales.js";
import { eq } from "drizzle-orm";

export const i18nService = {
    async getLocales(): Promise<Locale[]> {
        return db.select().from(locales);
    },

    async getLocale(code: string): Promise<Locale | undefined> {
        const result = await db.select().from(locales).where(eq(locales.code, code));
        return result[0];
    },

    async getDefaultLocale(): Promise<Locale | undefined> {
        const result = await db.select().from(locales).where(eq(locales.isDefault, true));
        return result[0];
    },

    async createLocale(data: NewLocale): Promise<Locale> {
        // If this is marked as default, unset previous default
        if (data.isDefault) {
            await db.update(locales).set({ isDefault: false });
        }
        
        const result = await db.insert(locales).values(data).returning();
        if (!result[0]) throw new Error("Failed to create locale");
        return result[0];
    },

    async updateLocale(code: string, data: Partial<NewLocale>): Promise<Locale> {
        if (data.isDefault) {
            await db.update(locales).set({ isDefault: false });
        }

        const result = await db.update(locales).set(data).where(eq(locales.code, code)).returning();
        if (!result[0]) throw new Error("Locale not found");
        return result[0];
    },

    async deleteLocale(code: string): Promise<void> {
        await db.delete(locales).where(eq(locales.code, code));
    },

    async getFallbackChain(code: string): Promise<string[]> {
        const locale = await this.getLocale(code);
        if (!locale) return [];
        return locale.fallbackChain;
    },

    /**
     * Given a requested locale, returns the list of locales to try in order.
     * e.g. "fr-CA" -> ["fr-CA", "fr", "en"] (assuming "en" is default and fallback is "fr")
     */
    async resolveLocaleOrder(requestedCode: string): Promise<string[]> {
        const chain: string[] = [requestedCode];
        
        const locale = await this.getLocale(requestedCode);
        if (locale && locale.fallbackChain.length > 0) {
            chain.push(...locale.fallbackChain);
        }

        const defaultLocale = await this.getDefaultLocale();
        if (defaultLocale && !chain.includes(defaultLocale.code)) {
            chain.push(defaultLocale.code);
        }

        return chain;
    }
};
