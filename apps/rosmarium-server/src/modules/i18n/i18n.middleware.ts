import { FastifyRequest, FastifyReply } from "fastify";
import { i18nService } from "./i18n.service.js";
import acceptLanguage from "accept-language-parser";

// Extend FastifyRequest to include locale
declare module "fastify" {
    interface FastifyRequest {
        locale?: string;
        localeFallbackChain?: string[];
    }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function i18nMiddleware(request: FastifyRequest, _reply: FastifyReply) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let requestedLocale = (request.query as any)?.locale as string | undefined;

    if (!requestedLocale) {
        const acceptLangHeader = request.headers["accept-language"];
        if (acceptLangHeader) {
            const parsed = acceptLanguage.parse(acceptLangHeader);
            if (parsed.length > 0) {
                try {
                    // Find first supported locale
                    const availableLocales = await i18nService.getLocales();
                    const availableCodes = availableLocales.map((l) => l.code);
                    
                    const match = acceptLanguage.pick(availableCodes, acceptLangHeader, { loose: true });
                    if (match) {
                        requestedLocale = match;
                    }
                } catch {
                    // Ignore DB errors during tests or migrations
                }
            }
        }
    }

    if (!requestedLocale) {
        try {
            const defaultLocale = await i18nService.getDefaultLocale();
            requestedLocale = defaultLocale?.code || "en";
        } catch {
            requestedLocale = "en";
        }
    }

    request.locale = requestedLocale;
    try {
        request.localeFallbackChain = await i18nService.resolveLocaleOrder(requestedLocale);
    } catch {
        request.localeFallbackChain = [requestedLocale];
    }
}
