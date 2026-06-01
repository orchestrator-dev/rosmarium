import { Hono } from 'hono';
import { getCachedContent, cacheContent, getCacheKey, invalidateCache } from './cache.js';

import type { KVNamespace } from '@cloudflare/workers-types';
export type Env = {
  CONTENT_CACHE: KVNamespace;
  ORIGIN_URL: string;
  INVALIDATION_SECRET: string;
};

const router = new Hono<{ Bindings: Env }>();

router.get('/api/content/:id', async (c) => {
  const id = c.req.param('id');
  const locale = c.req.query('locale');
  const branch = c.req.query('branch');
  
  const cacheKey = getCacheKey(c.req.url, id, { locale, branch });
  
  // 1. Try Cache (HIT)
  const cached = await getCachedContent(c.env.CONTENT_CACHE, cacheKey);
  if (cached) {
    c.header('X-Edge-Cache', 'HIT');
    c.header('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    return c.json(cached);
  }
  
  // 2. Cache MISS -> Origin
  const url = new URL(c.req.url);
  const originUrl = new URL(url.pathname + url.search, c.env.ORIGIN_URL);
  
  const response = await fetch(originUrl.toString(), {
    headers: {
      'Accept': c.req.header('Accept') || 'application/json',
      'X-Forwarded-For': c.req.header('CF-Connecting-IP') || '',
    }
  });

  if (!response.ok) {
    c.header('X-Edge-Cache', 'MISS');
    return new Response(response.body, {
      status: response.status,
      headers: response.headers
    });
  }

  const data = await response.json();
  
  // Cache the response asynchronously
  c.executionCtx.waitUntil(
    cacheContent(c.env.CONTENT_CACHE, cacheKey, data, 3600)
  );

  c.header('X-Edge-Cache', 'MISS');
  c.header('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  return c.json(data);
});

// Invalidation Endpoint
router.post('/internal/invalidate', async (c) => {
  const signatureHeader = c.req.header('X-Rosmarium-Signature');
  if (!signatureHeader) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const rawBody = await c.req.text();
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(c.env.INVALIDATION_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const signatureHex = signatureHeader.replace('sha256=', '');
  const signatureBytes = new Uint8Array(signatureHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));

  const isValid = await crypto.subtle.verify(
    'HMAC',
    key,
    signatureBytes,
    encoder.encode(rawBody)
  );

  if (!isValid) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const payload = JSON.parse(rawBody);
  const data = payload.data || {};
  const id = data.id || payload.id;
  const locale = data.locale;
  const branch = data.branch;

  if (id) {
    const key = getCacheKey('', id, { locale, branch });
    await invalidateCache(c.env.CONTENT_CACHE, key);
  }

  return c.json({ success: true, invalidatedCount: id ? 1 : 0 });
});

export default router;
