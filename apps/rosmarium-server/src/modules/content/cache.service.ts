import Redis from "ioredis";
import { config } from "../../config.js";
import { rosmariumEvents } from "../../lib/events.js";
import type { ContentEntry } from "../../db/schema/index.js";
import { logger } from "../../lib/logger.js";

const CACHE_PREFIX = "content:entry:";
const CACHE_TTL = 3600; // 1 hour

class ContentCacheService {
  private redis: Redis | null = null;

  constructor() {
    if (process.env.NODE_ENV !== "test") {
      this.redis = new Redis(config?.REDIS_URL || "", { lazyConnect: true });
      this.redis.connect().catch(() => {
        logger.warn("Failed to connect to Redis for content cache, running degraded without cache");
      });
    }

    this.initEventListeners();
  }

  private initEventListeners() {
    // Invalidate cache on content changes
    const invalidate = async (entryOrId: ContentEntry | string) => {
      const id = typeof entryOrId === "string" ? entryOrId : entryOrId.id;
      if (this.redis) {
        await this.redis.del(`${CACHE_PREFIX}${id}`);
      }
    };

    rosmariumEvents.on("content.updated", invalidate);
    rosmariumEvents.on("content.published", invalidate);
    rosmariumEvents.on("content.unpublished", invalidate);
    rosmariumEvents.on("content.deleted", invalidate);
  }

  async get(id: string): Promise<ContentEntry | null> {
    if (!this.redis) return null;
    try {
      const data = await this.redis.get(`${CACHE_PREFIX}${id}`);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  async set(entry: ContentEntry): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.setex(`${CACHE_PREFIX}${entry.id}`, CACHE_TTL, JSON.stringify(entry));
    } catch {
      // Ignore cache write errors
    }
  }

  async mget(ids: string[]): Promise<(ContentEntry | null)[]> {
    if (!this.redis || ids.length === 0) return ids.map(() => null);
    try {
      const keys = ids.map(id => `${CACHE_PREFIX}${id}`);
      const data = await this.redis.mget(keys);
      return data.map(item => (item ? JSON.parse(item) : null));
    } catch {
      return ids.map(() => null);
    }
  }

  async mset(entries: ContentEntry[]): Promise<void> {
    if (!this.redis || entries.length === 0) return;
    try {
      const pipeline = this.redis.pipeline();
      for (const entry of entries) {
        pipeline.setex(`${CACHE_PREFIX}${entry.id}`, CACHE_TTL, JSON.stringify(entry));
      }
      await pipeline.exec();
    } catch {
      // Ignore cache write errors
    }
  }
}

export const contentCacheService = new ContentCacheService();
