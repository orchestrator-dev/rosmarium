/**
 * HTTP client for cortex-ai-worker intelligence endpoints.
 *
 * Mirrors the pattern of rag.client.ts — calls /intelligence/* with X-Worker-Secret.
 * All methods throw IntelligenceError on HTTP or network failure.
 */

import { config } from "../../config.js";

const INTELLIGENCE_TIMEOUT_MS = 30_000;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TagResult {
    label: string;
    score: number;
}

export interface SummaryResult {
    summary: string;
    word_count: number;
    original_word_count: number;
    compression_ratio: number;
    model: string;
    generated_at: string;
}

export interface DuplicateCandidate {
    entry_id: string;
    content_type: string;
    similarity_score: number;
    is_duplicate: boolean;
}

export interface DuplicatePair {
    entryIdA: string;
    entryIdB: string;
    score: number;
}

export class IntelligenceError extends Error {
    constructor(
        message: string,
        public readonly statusCode?: number
    ) {
        super(message);
        this.name = "IntelligenceError";
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function workerPost<T>(
    path: string,
    body: Record<string, unknown>
): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), INTELLIGENCE_TIMEOUT_MS);

    try {
        const res = await fetch(`${config.AI_WORKER_URL}${path}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Worker-Secret": config.AI_WORKER_SECRET,
            },
            body: JSON.stringify(body),
            signal: controller.signal,
        });

        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new IntelligenceError(
                `AI worker returned ${res.status}: ${text}`,
                res.status
            );
        }

        return res.json() as Promise<T>;
    } catch (err) {
        if ((err as Error).name === "AbortError") {
            throw new IntelligenceError(`Intelligence request timed out: ${path}`);
        }
        if (err instanceof IntelligenceError) throw err;
        throw new IntelligenceError(`Intelligence request failed: ${String(err)}`);
    } finally {
        clearTimeout(timer);
    }
}

// ─── Client ───────────────────────────────────────────────────────────────────

export const intelligenceClient = {
    /**
     * POST /intelligence/tag — zero-shot auto-tagging.
     */
    async tag(
        text: string,
        labels: string[],
        threshold?: number
    ): Promise<{ tags: TagResult[]; model: string; latencyMs: number }> {
        return workerPost("/intelligence/tag", {
            text,
            candidateLabels: labels,
            threshold: threshold ?? 0.3,
        });
    },

    /**
     * POST /intelligence/ner — named entity extraction.
     */
    async extractEntities(text: string): Promise<{
        entities: Record<string, string[]>;
        count: number;
        latencyMs: number;
    }> {
        return workerPost("/intelligence/ner", { text });
    },

    /**
     * POST /intelligence/summarize — LLM summarization.
     */
    async summarize(
        text: string,
        opts?: { maxWords?: number; style?: "brief" | "detailed" | "bullet" }
    ): Promise<SummaryResult> {
        return workerPost("/intelligence/summarize", {
            text,
            maxWords: opts?.maxWords ?? 100,
            style: opts?.style ?? "brief",
        });
    },

    /**
     * POST /intelligence/duplicates — find duplicates for an entry.
     */
    async findDuplicates(
        entryId: string,
        contentType: string
    ): Promise<{ candidates: DuplicateCandidate[]; scannedCount: number; latencyMs: number }> {
        return workerPost("/intelligence/duplicates", { entryId, contentType });
    },

    /**
     * POST /intelligence/scan-duplicates — full collection scan.
     */
    async scanDuplicates(
        contentType: string
    ): Promise<{ pairs: DuplicatePair[]; total: number }> {
        return workerPost("/intelligence/scan-duplicates", { contentType });
    },
};
