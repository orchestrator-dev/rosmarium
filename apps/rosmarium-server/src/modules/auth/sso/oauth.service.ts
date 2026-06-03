import { Google, MicrosoftEntraId, Okta, OAuth2Client, generateState, generateCodeVerifier, decodeIdToken, CodeChallengeMethod } from "arctic";
import type { SSOProvider } from "../../../db/schema/sso-providers";

export type OAuthConfig = {
    clientId: string;
    clientSecret: string;
    authorizationEndpoint?: string;
    tokenEndpoint?: string;
    tenantId?: string; // For Azure/Microsoft
    domain?: string; // For Okta
    scopes?: string[];
};

export const oauthService = {
    getClient(provider: SSOProvider, redirectUri: string) {
        const config = provider.config as OAuthConfig;
        switch (provider.providerId) {
            case "google":
                return new Google(config.clientId, config.clientSecret, redirectUri);
            case "azure":
            case "microsoft":
                return new MicrosoftEntraId(config.tenantId!, config.clientId, config.clientSecret, redirectUri);
            case "okta":
                return new Okta(config.domain!, null, config.clientId, config.clientSecret, redirectUri);
            default:
                return new OAuth2Client(config.clientId, config.clientSecret, redirectUri);
        }
    },

    async getAuthorizationUrl(provider: SSOProvider, redirectUri: string) {
        const client = this.getClient(provider, redirectUri);
        const config = provider.config as OAuthConfig;
        const state = generateState();
        const codeVerifier = generateCodeVerifier();
        const scopes = config.scopes || ["openid", "profile", "email"];
        
        let url: URL;
        if (client instanceof OAuth2Client) {
            if (!config.authorizationEndpoint) {
                throw new Error("Generic OAuth2/OIDC provider must specify authorizationEndpoint");
            }
            url = client.createAuthorizationURLWithPKCE(config.authorizationEndpoint, state, CodeChallengeMethod.S256, codeVerifier, scopes);
        } else {
            // Google, MicrosoftEntraId, Okta
            const genericClient = client as { createAuthorizationURL: (s: string, c: string, sc: string[]) => URL };
            url = genericClient.createAuthorizationURL(state, codeVerifier, scopes);
        }

        return { url: url.toString(), state, codeVerifier };
    },

    async validateCallback(provider: SSOProvider, redirectUri: string, code: string, codeVerifier: string) {
        const client = this.getClient(provider, redirectUri);
        const config = provider.config as OAuthConfig;
        
        let tokens;
        if (client instanceof OAuth2Client) {
            if (!config.tokenEndpoint) {
                throw new Error("Generic OAuth2/OIDC provider must specify tokenEndpoint");
            }
            tokens = await client.validateAuthorizationCode(config.tokenEndpoint, code, codeVerifier);
        } else {
            const genericClient = client as { validateAuthorizationCode: (c: string, cv: string) => Promise<unknown> };
            tokens = await genericClient.validateAuthorizationCode(code, codeVerifier);
        }

        return tokens;
    },

    decodeIdToken(idToken: string) {
        return decodeIdToken(idToken);
    }
};
