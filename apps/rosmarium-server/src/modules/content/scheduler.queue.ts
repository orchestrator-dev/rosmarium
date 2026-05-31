import { Queue, Worker } from "bullmq";
import { contentCrudService } from "./crud.service.js";
import { config } from "../../config.js";

let _queue: Queue | null = null;

export function getSchedulerQueue(): Queue {
    if (_queue) return _queue;
    _queue = new Queue("schedule-jobs", {
        connection: { url: config.REDIS_URL },
    });
    return _queue;
}

export function startSchedulerWorker() {
    new Worker(
        "schedule-jobs",
        async (job) => {
            const { entryId, action, userId } = job.data;
            try {
                if (action === "publish") {
                    await contentCrudService.publish(entryId, userId);
                } else if (action === "unpublish") {
                    await contentCrudService.unpublish(entryId, userId);
                }
            } catch (err) {
                console.error(`Failed to execute scheduled ${action} on ${entryId}`, err);
                throw err; // For BullMQ to track failure
            }
        },
        {
            connection: { url: config.REDIS_URL },
        }
    );
}
