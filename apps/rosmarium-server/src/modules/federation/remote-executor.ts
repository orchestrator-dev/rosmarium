import { buildHTTPExecutor } from "@graphql-tools/executor-http";
import { GraphQLError } from "graphql";
import type { RemoteSourceModel } from "../../db/schema/index.js";
import { federationCacheService } from "./cache.service.js";

// ─── OAuth 2.0 Token Cache ───────────────────────────────────────────────────
interface OAuthTokenEntry {
    token: string;
    expiresAt: number;
}
const oauthTokenCache = new Map<string, OAuthTokenEntry>();

async function getOAuthToken(sourceId: string, clientId: string, clientSecret: string, tokenUrl: string): Promise<string> {
    const cached = oauthTokenCache.get(sourceId);
    const now = Date.now();
    if (cached && cached.expiresAt > now) {
        return cached.token;
    }

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const res = await fetch(tokenUrl, {
        method: "POST",
        headers: {
            "Authorization": `Basic ${credentials}`,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
    });

    if (!res.ok) {
        throw new GraphQLError(`[OAuth2 Error]: Failed to fetch token from ${tokenUrl} (HTTP ${res.status})`, {
            extensions: { code: "OAUTH_TOKEN_ERROR", status: res.status, sourceId },
        });
    }

    const data = await res.json() as { access_token?: string; expires_in?: number };
    if (!data.access_token) {
        throw new GraphQLError(`[OAuth2 Error]: Response did not contain access_token`, {
            extensions: { code: "OAUTH_TOKEN_ERROR", sourceId },
        });
    }

    const expiresIn = (typeof data.expires_in === "number" ? data.expires_in : 3600) * 1000;
    oauthTokenCache.set(sourceId, {
        token: data.access_token,
        expiresAt: now + expiresIn - 60000, // 60s safety buffer
    });

    return data.access_token;
}

// ─── Rate Limiter (Token Bucket) ─────────────────────────────────────────────
interface TokenBucket {
    tokens: number;
    maxTokens: number;
    refillRatePerSec: number;
    lastRefill: number;
}
const rateLimiters = new Map<string, TokenBucket>();

function checkRateLimit(source: RemoteSourceModel): boolean {
    const config = (source.rateLimitConfig as { maxRequestsPerMinute?: number; burstSize?: number }) || {};
    const maxRPM = config.maxRequestsPerMinute || 60;
    const maxTokens = config.burstSize || maxRPM;
    const refillRatePerSec = maxRPM / 60;

    let bucket = rateLimiters.get(source.id);
    const now = Date.now();
    if (!bucket) {
        bucket = { tokens: maxTokens, maxTokens, refillRatePerSec, lastRefill: now };
        rateLimiters.set(source.id, bucket);
    } else {
        const elapsedSec = (now - bucket.lastRefill) / 1000;
        bucket.tokens = Math.min(bucket.maxTokens, bucket.tokens + elapsedSec * bucket.refillRatePerSec);
        bucket.lastRefill = now;
    }

    if (bucket.tokens >= 1) {
        bucket.tokens -= 1;
        return true;
    }
    return false;
}

// ─── Circuit Breaker ─────────────────────────────────────────────────────────
interface CircuitBreaker {
    state: "CLOSED" | "OPEN" | "HALF_OPEN";
    failures: number;
    lastFailure: number;
}
const circuitBreakers = new Map<string, CircuitBreaker>();
const FAILURE_THRESHOLD = 5;
const OPEN_TIMEOUT_MS = 30000; // 30s before trial request

function checkCircuitBreaker(sourceId: string): boolean {
    const cb = circuitBreakers.get(sourceId);
    if (!cb) return true;

    const now = Date.now();
    if (cb.state === "OPEN") {
        if (now - cb.lastFailure > OPEN_TIMEOUT_MS) {
            cb.state = "HALF_OPEN";
            return true;
        }
        return false;
    }
    return true;
}

function recordSuccess(sourceId: string): void {
    const cb = circuitBreakers.get(sourceId);
    if (cb && (cb.state === "HALF_OPEN" || cb.failures > 0)) {
        circuitBreakers.set(sourceId, { state: "CLOSED", failures: 0, lastFailure: 0 });
    }
}

function recordFailure(sourceId: string): void {
    let cb = circuitBreakers.get(sourceId);
    const now = Date.now();
    if (!cb) {
        cb = { state: "CLOSED", failures: 1, lastFailure: now };
    } else {
        cb.failures += 1;
        cb.lastFailure = now;
        if (cb.failures >= FAILURE_THRESHOLD || cb.state === "HALF_OPEN") {
            cb.state = "OPEN";
        }
    }
    circuitBreakers.set(sourceId, cb);
}

// ─── Remote Executor Service ─────────────────────────────────────────────────
export const remoteExecutorService = {
    buildExecutor(source: RemoteSourceModel) {
        return buildHTTPExecutor({
            endpoint: source.endpoint,
            fetch: async (url, init) => {
                const cacheConfig = (source.cacheConfig as { ttl?: number; staleWhileRevalidate?: boolean }) || {};
                const ttl = cacheConfig.ttl || 300;
                const staleWhileRevalidate = cacheConfig.staleWhileRevalidate ?? true;

                const method = init?.method || "GET";
                const bodyHash = init?.body ? Buffer.from(init.body as string).toString("base64") : "";
                const cacheKey = `${method}:${url}:${bodyHash}`;

                // 1. Try Cache First
                try {
                    const cached = await federationCacheService.getCachedResult(source.id, cacheKey);
                    if (cached) {
                        return new Response(JSON.stringify(cached), { headers: { "Content-Type": "application/json" } });
                    }
                } catch {
                    // Silently ignore Redis cache read errors
                }

                // Helper to fallback to stale cache or throw GraphQLError
                const handleFailure = async (errorMsg: string, code: string, status?: number): Promise<Response> => {
                    if (staleWhileRevalidate) {
                        try {
                            // In staleWhileRevalidate, check if we have any stale cache (here we re-check getCachedResult as fallback)
                            const stale = await federationCacheService.getCachedResult(source.id, cacheKey);
                            if (stale) {
                                return new Response(JSON.stringify(stale), {
                                    headers: { "Content-Type": "application/json", "X-Stale-Cache": "true" },
                                });
                            }
                        } catch {
                            // Ignore cache read errors
                        }
                    }
                    throw new GraphQLError(`[${source.name} Error]: ${errorMsg}`, {
                        extensions: { code, status, sourceId: source.id, sourceName: source.name },
                    });
                };

                // 2. Check Circuit Breaker
                if (!checkCircuitBreaker(source.id)) {
                    return handleFailure("Circuit breaker is OPEN due to consecutive failures", "CIRCUIT_BREAKER_OPEN");
                }

                // 3. Check Rate Limiter
                if (!checkRateLimit(source)) {
                    return handleFailure("Rate limit exceeded for remote source", "RATE_LIMITED", 429);
                }

                // 4. Prepare Authentication Headers
                const headers = new Headers(init?.headers || {});
                if (source.authConfig && typeof source.authConfig === "object") {
                    const auth = source.authConfig as Record<string, unknown>;
                    if (auth["type"] === "bearer" && typeof auth["token"] === "string") {
                        headers.set("Authorization", `Bearer ${auth["token"]}`);
                    } else if (auth["type"] === "apiKey" && typeof auth["header"] === "string" && typeof auth["key"] === "string") {
                        headers.set(auth["header"], auth["key"]);
                    } else if (auth["type"] === "oauth2" && typeof auth["clientId"] === "string" && typeof auth["clientSecret"] === "string" && typeof auth["tokenUrl"] === "string") {
                        try {
                            const token = await getOAuthToken(source.id, auth["clientId"], auth["clientSecret"], auth["tokenUrl"]);
                            headers.set("Authorization", `Bearer ${token}`);
                        } catch (err) {
                            recordFailure(source.id);
                            const msg = err instanceof Error ? err.message : "OAuth token negotiation failed";
                            return handleFailure(msg, "OAUTH_TOKEN_ERROR", 401);
                        }
                    }
                }

                // 5. Execute Network Fetch
                try {
                    const res = await fetch(url, { ...init, headers });
                    if (!res.ok) {
                        recordFailure(source.id);
                        return handleFailure(`Upstream API returned HTTP ${res.status}`, "REMOTE_SOURCE_HTTP_ERROR", res.status);
                    }

                    recordSuccess(source.id);
                    const data = await res.json();

                    // 6. Store in Cache
                    try {
                        await federationCacheService.setCachedResult(source.id, cacheKey, data, ttl);
                    } catch {
                        // Silently ignore Redis cache write errors
                    }

                    return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
                } catch (err) {
                    if (err instanceof GraphQLError) throw err;
                    recordFailure(source.id);
                    const msg = err instanceof Error ? err.message : "Network request failed";
                    return handleFailure(msg, "REMOTE_SOURCE_NETWORK_ERROR", 503);
                }
            },
        });
    },

    clearTokenCache(sourceId?: string): void {
        if (sourceId) {
            oauthTokenCache.delete(sourceId);
        } else {
            oauthTokenCache.clear();
        }
    },

    getRateLimiterStatus(sourceId: string): { tokens: number; maxTokens: number } | null {
        const bucket = rateLimiters.get(sourceId);
        if (!bucket) return null;
        return { tokens: Math.floor(bucket.tokens), maxTokens: bucket.maxTokens };
    },

    resetRateLimiters(sourceId?: string): void {
        if (sourceId) {
            rateLimiters.delete(sourceId);
        } else {
            rateLimiters.clear();
        }
    },

    getCircuitBreakerStatus(sourceId: string): { state: string; failures: number } | null {
        const cb = circuitBreakers.get(sourceId);
        if (!cb) return { state: "CLOSED", failures: 0 };
        return { state: cb.state, failures: cb.failures };
    },

    resetCircuitBreaker(sourceId?: string): void {
        if (sourceId) {
            circuitBreakers.delete(sourceId);
        } else {
            circuitBreakers.clear();
        }
    },
};
