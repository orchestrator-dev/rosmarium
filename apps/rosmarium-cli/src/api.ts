import 'dotenv/config'; // loads .env automatically

export const API_URL = process.env.ROSMARIUM_URL || "http://localhost:3000";
export const API_KEY = process.env.ROSMARIUM_API_KEY;

export async function fetchApi(path: string, options: RequestInit = {}) {
    if (!API_KEY) {
        throw new Error("ROSMARIUM_API_KEY environment variable is required.");
    }

    const res = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${API_KEY}`,
            ...(options.headers || {}),
        },
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        throw new Error(data?.error?.message || `API request failed with status ${res.status}`);
    }

    return data.data;
}
