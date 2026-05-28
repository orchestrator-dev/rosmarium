import { Argon2id } from "oslo/password";
import { sha256 } from "oslo/crypto";
import { encodeHex } from "oslo/encoding";

const argon2id = new Argon2id();

/**
 * Hash a plaintext password using Argon2id (oslo).
 */
export async function hashPassword(password: string): Promise<string> {
    return argon2id.hash(password);
}

/**
 * Verify a plaintext password against a stored Argon2id hash.
 */
export async function verifyPassword(
    hash: string,
    password: string
): Promise<boolean> {
    return argon2id.verify(hash, password);
}

/**
 * Compute a SHA-256 hex digest of a string.
 * Used to hash API keys before storage.
 */
export async function sha256Hex(input: string): Promise<string> {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(input);
    const hashBuffer = await sha256(bytes);
    return encodeHex(hashBuffer);
}
