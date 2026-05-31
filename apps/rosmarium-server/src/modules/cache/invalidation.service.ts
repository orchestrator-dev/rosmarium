import { rosmariumEvents } from "../../lib/events.js";
import { logger } from "../../lib/logger.js";

// Configuration for edge worker
const EDGE_URL = process.env.EDGE_URL || "http://localhost:8787";
const INVALIDATION_SECRET = process.env.INVALIDATION_SECRET || "super-secret-key";

export const invalidationService = {
  /**
   * Invalidates content at the edge by communicating with the edge worker
   */
  async invalidateContent(id: string, locale?: string) {
    try {
      const response = await fetch(`${EDGE_URL}/internal/invalidate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${INVALIDATION_SECRET}`
        },
        body: JSON.stringify({
          ids: [id],
          locale
        })
      });

      if (!response.ok) {
        throw new Error(`Edge invalidation failed: ${response.statusText}`);
      }

      const result = await response.json();
      logger.info({ id, result }, "Edge cache invalidated");
    } catch (err) {
      logger.error({ id, err }, "Failed to invalidate edge cache");
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
