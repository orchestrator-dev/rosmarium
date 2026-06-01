import { rosmariumEvents } from "../../lib/events.js";
import { logger } from "../../lib/logger.js";
import { getWebhookQueue } from "../webhooks/webhook.queue.js";

// Configuration for edge worker
const EDGE_URL = process.env.EDGE_URL || "http://localhost:8787";
const INVALIDATION_SECRET = process.env.INVALIDATION_SECRET || "super-secret-key";

export const invalidationService = {
  /**
   * Invalidates content at the edge by communicating with the edge worker
   */
  async invalidateContent(id: string, locale?: string) {
    try {
      const queue = getWebhookQueue();
      await queue.add("deliver", {
        systemWebhook: { url: `${EDGE_URL}/internal/invalidate`, secret: INVALIDATION_SECRET },
        event: "entry.updated",
        contentType: "system",
        payload: { id, locale },
        attempt: 1,
      });
      logger.info({ id }, "Edge cache invalidation job enqueued");
    } catch (err) {
      logger.error({ id, err }, "Failed to enqueue edge cache invalidation");
    }
  },

  /**
   * Initializes listeners for content lifecycle events
   */
  init() {
    rosmariumEvents.on("content.updated", (entry) => {
      this.invalidateContent(entry.id, entry.locale).catch(console.error);
    });

    rosmariumEvents.on("content.published", (entry) => {
      this.invalidateContent(entry.id, entry.locale).catch(console.error);
    });

    rosmariumEvents.on("content.unpublished", (entry) => {
      this.invalidateContent(entry.id, entry.locale).catch(console.error);
    });

    rosmariumEvents.on("content.deleted", (id) => {
      // Assuming no locale info on delete event by default, invalidating default cache keys
      this.invalidateContent(id).catch(console.error);
    });

    logger.info("Edge cache invalidation service initialized");
  }
};
