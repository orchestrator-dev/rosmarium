import type { KVNamespace } from '@cloudflare/workers-types';

export interface CacheOptions {
  locale?: string;
  branch?: string;
  variantId?: string;
  segmentId?: string;
}

export const getCacheKey = (url: string, idOrPath: string, options?: CacheOptions) => {
  const locale = options?.locale || 'default';
  const branch = options?.branch || 'main';
  let key = `content:${locale}:${branch}:${idOrPath}`;
  if (options?.variantId) {
    key += `:variant:${options.variantId}`;
  } else if (options?.segmentId) {
    key += `:segment:${options.segmentId}`;
  }
  return key;
};


export const getCachedContent = async (kv: KVNamespace, key: string): Promise<unknown | null> => {
  const data = await kv.get(key, 'json');
  return data;
};

export const cacheContent = async (
  kv: KVNamespace,
  key: string,
  content: unknown,
  ttl: number = 3600
): Promise<void> => {
  await kv.put(key, JSON.stringify(content), { expirationTtl: ttl });
};

export const invalidateCache = async (kv: KVNamespace, key: string): Promise<void> => {
  await kv.delete(key);
};
