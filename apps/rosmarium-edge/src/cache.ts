import type { KVNamespace } from '@cloudflare/workers-types';

export interface CacheOptions {
  locale?: string;
  branch?: string;
}

export const getCacheKey = (url: string, idOrPath: string, options?: CacheOptions) => {
  const locale = options?.locale || 'default';
  const branch = options?.branch || 'main';
  return `content:${locale}:${branch}:${idOrPath}`;
};

export const getCachedContent = async (kv: KVNamespace, key: string): Promise<any | null> => {
  const data = await kv.get(key, 'json');
  return data;
};

export const cacheContent = async (
  kv: KVNamespace,
  key: string,
  content: any,
  ttl: number = 3600
): Promise<void> => {
  await kv.put(key, JSON.stringify(content), { expirationTtl: ttl });
};

export const invalidateCache = async (kv: KVNamespace, key: string): Promise<void> => {
  await kv.delete(key);
};
