import { SAML } from "@node-saml/node-saml";
import type { SSOProvider } from "../../../db/schema/sso-providers";

export type SAMLConfig = {
    entryPoint: string;
    issuer: string;
    cert: string;
};

export const samlService = {
    getSamlInstance(provider: SSOProvider, callbackUrl: string) {
        const config = provider.config as SAMLConfig;
        return new SAML({
            entryPoint: config.entryPoint,
            issuer: config.issuer,
            idpCert: config.cert,
            callbackUrl: callbackUrl,
            audience: config.issuer,
        });
    },

    async getAuthorizationUrl(provider: SSOProvider, callbackUrl: string, relayState?: string) {
        const saml = this.getSamlInstance(provider, callbackUrl);
        // getAuthorizeUrlAsync returns the full redirect URL
        return saml.getAuthorizeUrlAsync(relayState || "", "", {});
    },

    async validatePostResponse(provider: SSOProvider, callbackUrl: string, body: Record<string, string>) {
        const saml = this.getSamlInstance(provider, callbackUrl);
        return saml.validatePostResponseAsync(body);
    }
};
