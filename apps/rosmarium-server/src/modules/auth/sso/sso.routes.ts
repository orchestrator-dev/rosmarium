import { FastifyInstance } from "fastify";
import { ssoService, type SSOProfile } from "./sso.service.js";
import { oauthService } from "./oauth.service.js";
import { samlService } from "./saml.service.js";
import { lucia } from "../lucia.js";

export async function ssoRoutes(app: FastifyInstance) {
    app.get("/providers", async () => {
        const providers = await ssoService.getActiveProviders();
        return providers.map(p => ({
            id: p.id,
            name: p.name,
            providerId: p.providerId,
            type: p.type
        }));
    });

    app.get("/login/:providerId", async (request, reply) => {
        const { providerId } = request.params as { providerId: string };
        const provider = await ssoService.getProviderById(providerId);
        if (!provider || !provider.isActive) {
            return reply.status(404).send({ error: "Provider not found or inactive" });
        }

        const redirectUri = `${request.protocol}://${request.hostname}/api/auth/sso/callback/${provider.id}`;

        if (provider.type === "saml") {
            const url = await samlService.getAuthorizationUrl(provider, redirectUri);
            return reply.redirect(url);
        } else {
            const { url, state, codeVerifier } = await oauthService.getAuthorizationUrl(provider, redirectUri);
            
            reply.setCookie("sso_state", state, {
                path: "/",
                secure: process.env.NODE_ENV === "production",
                httpOnly: true,
                maxAge: 60 * 10,
                sameSite: "lax"
            });
            reply.setCookie("sso_code_verifier", codeVerifier, {
                path: "/",
                secure: process.env.NODE_ENV === "production",
                httpOnly: true,
                maxAge: 60 * 10,
                sameSite: "lax"
            });

            return reply.redirect(url);
        }
    });

    app.get("/callback/:providerId", async (request, reply) => {
        const { providerId } = request.params as { providerId: string };
        const provider = await ssoService.getProviderById(providerId);
        if (!provider || provider.type === "saml" || !provider.isActive) {
            return reply.status(400).send({ error: "Invalid provider" });
        }

        const query = request.query as Record<string, string>;
        const code = query.code;
        const state = query.state;
        const storedState = request.cookies.sso_state;
        const storedCodeVerifier = request.cookies.sso_code_verifier;

        if (!code || !state || !storedState || state !== storedState) {
            return reply.status(400).send({ error: "Invalid state or code" });
        }

        const redirectUri = `${request.protocol}://${request.hostname}/api/auth/sso/callback/${provider.id}`;
        
        try {
            const tokens = await oauthService.validateCallback(provider, redirectUri, code, storedCodeVerifier || "");
            
            let profile: Partial<SSOProfile> = {};
            if ((tokens as Record<string, unknown>).idToken) {
                const claims = oauthService.decodeIdToken((tokens as Record<string, string>).idToken) as Record<string, unknown>;
                profile = {
                    email: claims.email as string,
                    firstName: claims.given_name as string,
                    lastName: claims.family_name as string,
                    groups: (claims.groups as string[]) || [],
                };
            } else if ((tokens as Record<string, unknown>).accessToken) {
                // Simplified fallback if no id_token. Real implementation should fetch /userinfo
                throw new Error("OIDC requires id_token to auto-provision users");
            } else {
                throw new Error("Invalid tokens returned from provider");
            }

            const user = await ssoService.processSSOLogin(provider, profile as SSOProfile);
            if (!user) throw new Error("Failed to provision user");
            
            const session = await lucia.createSession(user.id, {});
            const sessionCookie = lucia.createSessionCookie(session.id);
            reply.setCookie(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);
            
            return reply.redirect("/");
        } catch (err: unknown) {
            const error = err as Error;
            request.log.error(error);
            return reply.status(500).send({ error: error.message || "SSO login failed" });
        }
    });

    app.post("/callback/:providerId", async (request, reply) => {
        const { providerId } = request.params as { providerId: string };
        const provider = await ssoService.getProviderById(providerId);
        if (!provider || provider.type !== "saml" || !provider.isActive) {
            return reply.status(400).send({ error: "Invalid provider" });
        }

        const redirectUri = `${request.protocol}://${request.hostname}/api/auth/sso/callback/${provider.id}`;
        
        try {
            const { profile: samlProfile } = await samlService.validatePostResponse(provider, redirectUri, request.body as Record<string, unknown>);
            
            const profile = {
                email: samlProfile?.email || samlProfile?.nameID,
                firstName: samlProfile?.firstName,
                lastName: samlProfile?.lastName,
                groups: samlProfile?.groups || []
            };

            const user = await ssoService.processSSOLogin(provider, profile as SSOProfile);
            if (!user) throw new Error("Failed to provision user");
            
            const session = await lucia.createSession(user.id, {});
            const sessionCookie = lucia.createSessionCookie(session.id);
            reply.setCookie(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);
            
            return reply.redirect("/");
        } catch (err: unknown) {
            const error = err as Error;
            request.log.error(error);
            return reply.status(500).send({ error: error.message || "SAML login failed" });
        }
    });
}
