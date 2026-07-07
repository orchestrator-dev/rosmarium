/* eslint-disable @typescript-eslint/no-explicit-any */
// Edge Analytics & Traits extraction

export const extractTraits = (req: Request): Record<string, any> => {
    const traits: Record<string, any> = {};

    // Geography (Cloudflare/Vercel standard headers)
    traits.country = req.headers.get("cf-ipcountry") || req.headers.get("x-vercel-ip-country") || "US";
    traits.city = req.headers.get("cf-ipcity") || req.headers.get("x-vercel-ip-city") || "";
    traits.region = req.headers.get("cf-region") || req.headers.get("x-vercel-ip-country-region") || "";
    traits.timezone = req.headers.get("cf-timezone") || req.headers.get("x-vercel-ip-timezone") || "UTC";

    // User Agent / Device & OS
    const ua = req.headers.get("user-agent") || "";
    traits.deviceType = /Mobile|Android|iP(ad|hone)/i.test(ua) ? "mobile" : /Tablet|iPad/i.test(ua) ? "tablet" : "desktop";
    traits.os = /Mac OS X/i.test(ua) ? "macOS" : /Windows/i.test(ua) ? "Windows" : /Linux/i.test(ua) ? "Linux" : /Android/i.test(ua) ? "Android" : /iOS|iPhone|iPad/i.test(ua) ? "iOS" : "Unknown";
    traits.browser = /Chrome/i.test(ua) ? "Chrome" : /Safari/i.test(ua) ? "Safari" : /Firefox/i.test(ua) ? "Firefox" : /Edge/i.test(ua) ? "Edge" : "Other";

    // Cookies / Authentication
    const cookieHeader = req.headers.get("cookie") || "";
    const cookies = Object.fromEntries(
        cookieHeader
            .split("; ")
            .filter(Boolean)
            .map((c) => {
                const parts = c.split("=");
                return [parts[0], parts.slice(1).join("=")];
            })
    );

    if (cookies.rosmarium_user_segment) {
        traits.userSegment = cookies.rosmarium_user_segment;
    }
    if (cookies.rosmarium_user_id) {
        traits.userId = cookies.rosmarium_user_id;
        traits.isLoggedIn = true;
    } else {
        traits.isLoggedIn = false;
    }

    // Custom Traits via Header (e.g., from upstream gateway or CDN)
    const customHeader = req.headers.get("x-rosmarium-traits");
    if (customHeader) {
        try {
            const customTraits = JSON.parse(customHeader);
            Object.assign(traits, customTraits);
        } catch {
            // Ignore invalid JSON in custom traits header
        }
    }

    // JWT Claims (if Authorization bearer present, decode payload without verification for fast edge trait matching)
    const authHeader = req.headers.get("authorization") || "";
    if (authHeader.startsWith("Bearer ")) {
        try {
            const token = authHeader.slice(7);
            const payloadPart = token.split(".")[1];
            if (payloadPart) {
                const decoded = JSON.parse(atob(payloadPart.replace(/-/g, "+").replace(/_/g, "/")));
                if (decoded && typeof decoded === "object") {
                    traits.jwt = decoded;
                    if (decoded.sub) traits.userId = decoded.sub;
                    if (decoded.role || decoded.roles) traits.role = decoded.role || decoded.roles;
                }
            }
        } catch {
            // Ignore JWT decode errors
        }
    }

    return traits;
};

