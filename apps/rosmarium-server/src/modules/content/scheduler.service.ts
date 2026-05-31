import { getSchedulerQueue } from "./scheduler.queue.js";

import { db } from "../../db/index.js";
import { contentEntries } from "../../db/schema/index.js";
import { eq } from "drizzle-orm";

export const schedulerService = {
    async scheduleAction(entryId: string, action: "publish" | "unpublish", scheduledAt: Date, userId: string, contentTypeName: string) {
        const queue = getSchedulerQueue();
        const delay = scheduledAt.getTime() - Date.now();
        
        if (delay <= 0) {
            throw new Error("Scheduled time must be in the future");
        }

        // Verify entry exists
        const [entry] = await db.select().from(contentEntries).where(eq(contentEntries.id, entryId));
        if (!entry) {
            throw new Error("Entry not found");
        }

        // Add to BullMQ with delay
        const job = await queue.add(
            `schedule-${action}-${entryId}`,
            { entryId, action, userId, contentTypeName },
            { delay, jobId: `schedule-${action}-${entryId}` } // Use predictable job ID to allow replacing
        );

        return job.id;
    },

    async cancelScheduled(entryId: string, action: "publish" | "unpublish") {
        const queue = getSchedulerQueue();
        const jobId = `schedule-${action}-${entryId}`;
        const job = await queue.getJob(jobId);
        
        if (job) {
            await job.remove();
        }
    },

    async getScheduledJobs(entryId: string) {
        const queue = getSchedulerQueue();
        const delayed = await queue.getDelayed();
        return delayed.filter(j => j.data.entryId === entryId).map(j => ({
            action: j.data.action,
            scheduledAt: new Date(j.timestamp + j.delay),
            jobId: j.id
        }));
    }
};
