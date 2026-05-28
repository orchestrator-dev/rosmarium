import { Queue, Worker } from "bullmq";
import { createHmac } from "node:crypto";
import { db } from "../../db/index.js";
import { webhooks, webhookDeliveries } from "../../db/schema/index.js";
import { eq } from "drizzle-orm";
import { config } from "../../config.js";
import { createId } from "@paralleldrive/cuid2";

export interface WebhookJobData {
    webhookId: string;
    event: string;
    contentType: string;
    payload: unknown;
    attempt: number;
}

function makeRedisConn() {
    const url = new URL(config.REDIS_URL);
    return { host: url.hostname, port: Number(url.port) || 6379 };
}

// Lazy singleton — queue is created on first access, not at module import time
let _queue: Queue<WebhookJobData> | null = null;
let _worker: Worker<WebhookJobData> | null = null;

export function getWebhookQueue(): Queue<WebhookJobData> {
    if (_queue) return _queue;
    _queue = new Queue<WebhookJobData>("webhook-deliveries", {
        connection: makeRedisConn(),
        defaultJobOptions: {
            attempts: 5,
            backoff: { type: "exponential", delay: 1000 },
            removeOnComplete: { count: 500 },
            removeOnFail: { count: 200 },
        },
    });
    return _queue;
}

export function getWebhookWorker(): Worker<WebhookJobData> {
    if (_worker) return _worker;

    _worker = new Worker<WebhookJobData>(
        "webhook-deliveries",
        async (job) => {
            const { webhookId, event, contentType, payload, attempt } = job.data;

            const [webhook] = await db
                .select()
                .from(webhooks)
                .where(eq(webhooks.id, webhookId))
                .limit(1);

            if (!webhook || !webhook.isActive) return;

            const deliveryId = createId();
            const body = JSON.stringify({
                event,
                contentType,
                data: payload,
                deliveryId,
                timestamp: new Date().toISOString(),
            });

            const signature = createHmac("sha256", webhook.secret).update(body).digest("hex");

            const startMs = Date.now();
            let responseCode: number | null = null;
            let responseBody: string | null = null;
            let success = false;

            try {
                const res = await fetch(webhook.url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-Rosmarium-Signature": `sha256=${signature}`,
                        "X-Rosmarium-Event": event,
                        "X-Rosmarium-Delivery": deliveryId,
                        "User-Agent": "Rosmarium-CMS-Webhooks/1.0",
                    },
                    body,
                    signal: AbortSignal.timeout(10_000),
                });

                responseCode = res.status;
                responseBody = (await res.text()).substring(0, 2000);
                success = res.status >= 200 && res.status < 300;
            } catch (err) {
                responseBody = err instanceof Error ? err.message : String(err);
            }

            const durationMs = Date.now() - startMs;

            await db.insert(webhookDeliveries).values({
                id: deliveryId,
                webhookId,
                event,
                payload: payload as Record<string, unknown>,
                responseCode,
                responseBody,
                durationMs,
                success,
                attempt,
            });

            if (!success) {
                throw new Error(`Webhook delivery failed: HTTP ${responseCode ?? "network error"}`);
            }
        },
        { connection: makeRedisConn(), concurrency: 10 },
    );

    _worker.on("error", (err) => console.error("[webhook-worker] error", err));
    return _worker;
}
