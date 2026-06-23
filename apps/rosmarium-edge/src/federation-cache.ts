export async function checkFederationCache(request: Request, env: Env): Promise<Response | null> {
    const url = new URL(request.url);
    if (url.pathname !== "/graphql" || request.method !== "POST") {
        return null;
    }

    try {
        const bodyClone = await request.clone().text();
        const queryHash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(bodyClone));
        const hashHex = Array.from(new Uint8Array(queryHash)).map(b => b.toString(16).padStart(2, '0')).join('');
        const cacheKey = `edge:federation:cache:${hashHex}`;

        const cached = await env.KV_STORE.get(cacheKey, "json");
        if (cached) {
            return new Response(JSON.stringify(cached), {
                headers: {
                    "Content-Type": "application/json",
                    "X-Edge-Federation-Cache": "HIT"
                }
            });
        }
    } catch (err) {
        console.error("Federation cache check failed:", err);
    }
    
    return null;
}

export async function setFederationCache(request: Request, response: Response, env: Env): Promise<void> {
    const url = new URL(request.url);
    if (url.pathname !== "/graphql" || request.method !== "POST" || !response.ok) {
        return;
    }

    try {
        const bodyClone = await request.clone().text();
        const queryHash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(bodyClone));
        const hashHex = Array.from(new Uint8Array(queryHash)).map(b => b.toString(16).padStart(2, '0')).join('');
        const cacheKey = `edge:federation:cache:${hashHex}`;

        const respClone = await response.clone().text();
        // Assuming default TTL of 60 seconds at the edge if not specified
        await env.KV_STORE.put(cacheKey, respClone, { expirationTtl: 60 });
    } catch (err) {
        console.error("Federation cache set failed:", err);
    }
}

interface Env {
    KV_STORE: KVNamespace;
}
