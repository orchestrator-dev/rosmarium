// Edge Analytics & Traits extraction

export const extractTraits = (req: Request) => {
    const traits: Record<string, any> = {};

    // Geography (Cloudflare/Vercel standard headers)
    traits.country = req.headers.get("cf-ipcountry") || req.headers.get("x-vercel-ip-country");
    traits.city = req.headers.get("cf-ipcity") || req.headers.get("x-vercel-ip-city");
    
    // User Agent / Device
    const ua = req.headers.get("user-agent") || "";
    traits.deviceType = /Mobile|Android|iP(ad|hone)/.test(ua) ? 'mobile' : 'desktop';

    // Cookies / Authentication
    const cookieHeader = req.headers.get("cookie") || "";
    const cookies = Object.fromEntries(cookieHeader.split("; ").map(c => c.split("=")));
    
    if (cookies.rosmarium_user_segment) {
        traits.userSegment = cookies.rosmarium_user_segment;
    }

    if (cookies.rosmarium_user_id) {
        traits.isLoggedIn = true;
    } else {
        traits.isLoggedIn = false;
    }

    return traits;
};
