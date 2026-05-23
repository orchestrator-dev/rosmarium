/**
 * Intelligence job dispatcher — enqueues 'analyse-content' jobs to BullMQ.
 *
 * Jobs are triggered on content.published events when
 * contentType.settings.aiIntelligence.enabled is true.
 */

import { Queue } from "bullmq";
import { config } from "../../config.js";

const intelligenceQueue = new Queue("intelligence-jobs", {
    connection: { url: config.REDIS_URL },
});

export interface IntelligenceJobOpts {
    contentEntryId: string;
    contentType: string;
    fields: { fieldName: string; text: string }[];
    locale: string;
    candidateLabels: string[];
    operations: ("tag" | "ner" | "summarize" | "deduplicate")[];
}

/**
 * Dispatch an intelligence analysis job to the ai-worker queue.
 */
export async function dispatchIntelligenceJob(opts: IntelligenceJobOpts): Promise<void> {
    await intelligenceQueue.add("analyse-content", opts, {
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 50,
    });
}

/**
 * Get queue statistics for all managed queues.
 */
export async function getQueueStats(): Promise<
    Array<{
        queueName: string;
        waiting: number;
        active: number;
        completed: number;
        failed: number;
        delayed: number;
    }>
> {
    const embeddingQueue = new Queue("embedding-jobs", {
        connection: { url: config.REDIS_URL },
    });
    const webhookQueue = new Queue("webhook-deliveries", {
        connection: { url: config.REDIS_URL },
    });

    const queues = [embeddingQueue, intelligenceQueue, webhookQueue];

    const stats = await Promise.all(
        queues.map(async (q) => ({
            queueName: q.name,
            waiting: await q.getWaitingCount(),
            active: await q.getActiveCount(),
            completed: await q.getCompletedCount(),
            failed: await q.getFailedCount(),
            delayed: await q.getDelayedCount(),
        }))
    );

    await Promise.all(queues.map((q) => q.close()));

    return stats;
}
