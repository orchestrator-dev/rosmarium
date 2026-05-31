import { SignJWT, jwtVerify } from "jose";

// In a real production app, this should be an environment variable.
// Since Rosmarium uses a headless environment and for the sake of this phase, we'll use a strong secret.
const JWT_SECRET = new TextEncoder().encode(
    process.env.PREVIEW_JWT_SECRET || "rosmarium_super_secret_preview_key_32_bytes_long"
);

export interface PreviewTokenPayload {
    entryId: string;
    contentTypeId: string;
}

export const previewService = {
    /** Generate a JWT preview token for a specific entry. Valid for 1 hour. */
    async generateToken(entryId: string, contentTypeId: string): Promise<string> {
        return new SignJWT({ entryId, contentTypeId })
            .setProtectedHeader({ alg: "HS256" })
            .setIssuedAt()
            .setExpirationTime("1h")
            .sign(JWT_SECRET);
    },

    /** Verify a JWT preview token and return its payload. */
    async verifyToken(token: string): Promise<PreviewTokenPayload> {
        try {
            const { payload } = await jwtVerify(token, JWT_SECRET);
            if (!payload.entryId || !payload.contentTypeId) {
                throw new Error("Invalid token payload structure");
            }
            return {
                entryId: String(payload.entryId),
                contentTypeId: String(payload.contentTypeId),
            };
        } catch (error) {
            throw new Error(`Invalid or expired preview token: ${(error as Error).message}`);
        }
    },
};
