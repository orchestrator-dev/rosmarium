import { Hono } from 'hono';
import { getCachedContent, cacheContent, getCacheKey, invalidateCache } from './cache.js';
import { applyPersonalization, getSegmentsFromKV } from './personalization.js';
import { extractTraits } from './traits.js';

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

router.get('/api/personalized/content/:id', async (c) => {
  const id = c.req.param('id');
  const locale = c.req.query('locale');
  const branch = c.req.query('branch');
  const abTestRatio = c.req.query('abTestRatio') ? Number(c.req.query('abTestRatio')) : undefined;

  const segments = await getSegmentsFromKV(c.env.CONTENT_CACHE, c.env.ORIGIN_URL);
  const traits = extractTraits(c.req.raw);

  // Quick segment match check to try per-segment edge cache HIT
  let quickMatchedSegmentId: string | undefined;
  for (const seg of segments) {
    if (!seg.conditions || seg.conditions.length === 0) {
      quickMatchedSegmentId = seg.id;
      break;
    }
    const isMatch = seg.logic === 'or'
      ? seg.conditions.some((cond: any) => traits[cond.trait] === cond.value)
      : seg.conditions.every((cond: any) => traits[cond.trait] === cond.value);
    if (isMatch) {
      quickMatchedSegmentId = seg.id;
      break;
    }
  }

  if (quickMatchedSegmentId && abTestRatio === undefined) {
    const pCacheKey = getCacheKey('', id, { locale, branch, segmentId: quickMatchedSegmentId });
    const cachedPersonalized = await getCachedContent(c.env.CONTENT_CACHE, pCacheKey);
    if (cachedPersonalized) {
      c.header('X-Edge-Cache', 'HIT');
      c.header('X-Rosmarium-Personalized', 'true');
      c.header('X-Rosmarium-Segment-Id', quickMatchedSegmentId);
      c.header('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
      return c.json(cachedPersonalized);
    }
  }

  // Fetch base content (try base cache first, then origin)
  const baseCacheKey = getCacheKey('', id, { locale, branch });
  let baseContent = await getCachedContent(c.env.CONTENT_CACHE, baseCacheKey);
  let baseHit = true;

  if (!baseContent) {
    baseHit = false;
    const url = new URL(c.req.url);
    const originUrl = new URL(`/api/content/${id}${url.search}`, c.env.ORIGIN_URL);
    const res = await fetch(originUrl.toString(), {
      headers: {
        'Accept': c.req.header('Accept') || 'application/json',
        'X-Forwarded-For': c.req.header('CF-Connecting-IP') || '',
      }
    });
    if (!res.ok) {
      c.header('X-Edge-Cache', 'MISS');
      return new Response(res.body, { status: res.status, headers: res.headers });
    }
    baseContent = await res.json();
    c.executionCtx.waitUntil(cacheContent(c.env.CONTENT_CACHE, baseCacheKey, baseContent, 3600));
  }

  const result = await applyPersonalization(c.req.raw, baseContent, segments, {
    abTestRatio,
    kv: c.env.CONTENT_CACHE,
    originUrl: c.env.ORIGIN_URL,
  });

  if (result.isPersonalized && result.segmentId && abTestRatio === undefined) {
    const pCacheKey = getCacheKey('', id, { locale, branch, segmentId: result.segmentId, variantId: result.variantId });
    c.executionCtx.waitUntil(cacheContent(c.env.CONTENT_CACHE, pCacheKey, result.content, 3600));
  }

  c.header('X-Edge-Cache', baseHit ? 'HIT' : 'MISS');
  c.header('X-Rosmarium-Personalized', result.isPersonalized ? 'true' : 'false');
  if (result.variantId) c.header('X-Rosmarium-Variant-Id', result.variantId);
  if (result.segmentId) c.header('X-Rosmarium-Segment-Id', result.segmentId);
  c.header('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');

  return c.json(result.content);
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
