import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { intelligenceService } from "../../modules/intelligence/intelligence.service.js";
import { contentCrudService } from "../../modules/content/crud.service.js";
import { config } from "../../config.js";

export const registerAiTools = (server: McpServer) => {
    // ── ai_summarize ─────────────────────────────────────────────────────
    server.tool(
        "ai_summarize",
        "Generate a summary of a content entry using the AI worker. Optionally save the summary to the entry's metadata.",
        {
            entryId: z.string().describe("The ID of the content entry to summarize"),
            contentType: z.string().describe("The content type name of the entry"),
            save: z
                .boolean()
                .optional()
                .default(false)
                .describe("Whether to save the summary to entry metadata (default false)"),
            maxWords: z
                .number()
                .optional()
                .describe("Maximum word count for the summary"),
            style: z
                .enum(["brief", "detailed", "bullet"])
                .optional()
                .default("brief")
                .describe("Style of the summary (default 'brief')"),
        },
        async ({ entryId, contentType, save, maxWords, style }) => {
            try {
                const entry = await contentCrudService.findOne({
                    contentTypeName: contentType,
                    id: entryId,
                });
                if (!entry) {
                    return {
                        content: [
                            {
                                type: "text" as const,
                                text: JSON.stringify({ error: `Entry '${entryId}' not found` }, null, 2),
                            },
                        ],
                        isError: true,
                    };
                }
                const text = typeof entry.data === "object" ? JSON.stringify(entry.data) : String(entry.data);
                const summary = await intelligenceService.summarize({
                    entryId,
                    text,
                    save,
                    maxWords,
                    style,
                });
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: JSON.stringify(summary, null, 2),
                        },
                    ],
                };
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : "Unknown error";
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: JSON.stringify({ error: message }, null, 2),
                        },
                    ],
                    isError: true,
                };
            }
        }
    );

    // ── ai_tag ───────────────────────────────────────────────────────────
    server.tool(
        "ai_tag",
        "Perform zero-shot classification/tagging on a content entry against a list of candidate labels. Optionally save tags to metadata.",
        {
            entryId: z.string().describe("The ID of the content entry to tag"),
            contentType: z.string().describe("The content type name of the entry"),
            labels: z
                .array(z.string())
                .describe("Array of candidate category/tag labels to test against"),
            save: z
                .boolean()
                .optional()
                .default(false)
                .describe("Whether to save assigned tags to entry metadata (default false)"),
            threshold: z
                .number()
                .min(0)
                .max(1)
                .optional()
                .describe("Confidence threshold (0.0 to 1.0) for assigning a tag"),
        },
        async ({ entryId, contentType, labels, save, threshold }) => {
            try {
                const entry = await contentCrudService.findOne({
                    contentTypeName: contentType,
                    id: entryId,
                });
                if (!entry) {
                    return {
                        content: [
                            {
                                type: "text" as const,
                                text: JSON.stringify({ error: `Entry '${entryId}' not found` }, null, 2),
                            },
                        ],
                        isError: true,
                    };
                }
                const text = typeof entry.data === "object" ? JSON.stringify(entry.data) : String(entry.data);
                const result = await intelligenceService.tagEntry({
                    entryId,
                    text,
                    labels,
                    save,
                    threshold,
                });
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: JSON.stringify(result, null, 2),
                        },
                    ],
                };
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : "Unknown error";
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: JSON.stringify({ error: message }, null, 2),
                        },
                    ],
                    isError: true,
                };
            }
        }
    );

    // ── ai_translate ─────────────────────────────────────────────────────
    server.tool(
        "ai_translate",
        "Translate text or content structures to a target language using the AI worker.",
        {
            text: z.string().describe("Text or JSON string to translate"),
            targetLanguage: z
                .string()
                .describe("Target language ISO code (e.g. 'fr', 'de', 'es')"),
        },
        async ({ text, targetLanguage }) => {
            try {
                const res = await fetch(`${config.AI_WORKER_URL}/translation/translate`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-Worker-Secret": config.AI_WORKER_SECRET,
                    },
                    body: JSON.stringify({ text, targetLanguage }),
                });
                if (!res.ok) {
                    throw new Error(`AI worker translation failed with status ${res.status}: ${await res.text()}`);
                }
                const data = await res.json();
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: JSON.stringify(data, null, 2),
                        },
                    ],
                };
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : "Unknown error";
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: JSON.stringify({ error: message }, null, 2),
                        },
                    ],
                    isError: true,
                };
            }
        }
    );

    // ── ai_generate ──────────────────────────────────────────────────────
    server.tool(
        "ai_generate",
        "Generate content or text using the AI worker based on a prompt and optional context.",
        {
            prompt: z.string().describe("The instruction or prompt for text generation"),
            context: z
                .record(z.unknown())
                .optional()
                .describe("Optional structured context data to assist generation"),
        },
        async ({ prompt, context }) => {
            try {
                const res = await fetch(`${config.AI_WORKER_URL}/generation/generate`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-Worker-Secret": config.AI_WORKER_SECRET,
                    },
                    body: JSON.stringify({ prompt, context }),
                });
                if (!res.ok) {
                    throw new Error(`AI worker generation failed with status ${res.status}: ${await res.text()}`);
                }
                const data = await res.json();
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: JSON.stringify(data, null, 2),
                        },
                    ],
                };
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : "Unknown error";
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: JSON.stringify({ error: message }, null, 2),
                        },
                    ],
                    isError: true,
                };
            }
        }
    );
};
