import { config } from "../../../config.js";

export interface NodeAnalytics {
    pagerankScore: number;
    betweennessScore: number;
    communityId: number;
    hubScore: number;
    authorityScore: number;
    degreeIn: number;
    degreeOut: number;
    computedAt: string;
}


class AnalyticsError extends Error {
    constructor(
        message: string,
        public readonly statusCode?: number
    ) {
        super(message);
        this.name = "AnalyticsError";
    }
}

export const analyticsClient = {
    async triggerCompute(contentType?: string, requestedBy = "system"): Promise<void> {
        const res = await fetch(`${config.AI_WORKER_URL}/graph/analytics/compute`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Worker-Secret": config.AI_WORKER_SECRET,
            },
            body: JSON.stringify({ contentType, requestedBy }),
        });

        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new AnalyticsError(`AI worker returned ${res.status}: ${text}`, res.status);
        }
    },

    async getEntryAnalytics(entryId: string): Promise<NodeAnalytics | null> {
        const res = await fetch(`${config.AI_WORKER_URL}/graph/analytics/${entryId}`, {
            headers: {
                "X-Worker-Secret": config.AI_WORKER_SECRET,
            },
        });

        if (res.status === 404) return null;

        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new AnalyticsError(`AI worker returned ${res.status}: ${text}`, res.status);
        }

        return res.json() as Promise<NodeAnalytics>;
    },

    async exportGraph(opts: {
        format: "json-ld" | "rdf" | "cytoscape" | "graphml";
        contentType?: string;
        includeAnalytics?: boolean;
    }): Promise<ReadableStream<Uint8Array>> {
        const params = new URLSearchParams({ format: opts.format });
        if (opts.contentType) params.set("contentType", opts.contentType);
        if (opts.includeAnalytics !== undefined) {
            params.set("includeAnalytics", String(opts.includeAnalytics));
        }

        const res = await fetch(`${config.AI_WORKER_URL}/graph/export?${params.toString()}`, {
            headers: {
                "X-Worker-Secret": config.AI_WORKER_SECRET,
            },
        });

        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new AnalyticsError(`AI worker returned ${res.status}: ${text}`, res.status);
        }

        if (!res.body) {
            throw new AnalyticsError("Response body is empty");
        }

        // fetch from node-fetch/undici returns standard web ReadableStream
        return res.body as unknown as ReadableStream<Uint8Array>;
    },
};
