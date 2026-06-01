import { describe, it, expect, vi, beforeEach } from 'vitest';
import worker from './worker.js';
import type { Env } from './router.js';
import type { KVNamespace, ExecutionContext } from '@cloudflare/workers-types';
describe('Edge Worker', () => {
  let mockKV: { get: ReturnType<typeof vi.fn>; put: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };
  let mockEnv: Env;
  let mockCtx: { waitUntil: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockKV = {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    };

    mockEnv = {
      CONTENT_CACHE: mockKV as unknown as KVNamespace,
      ORIGIN_URL: 'http://test.origin',
      INVALIDATION_SECRET: 'test-secret',
    };

    mockCtx = {
      waitUntil: vi.fn(),
    };
    
    // Mock global fetch for misses
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: () => Promise.resolve({ id: 'test-123', title: 'Origin Content' }),
    });
  });

  it('should return cache hit when content is in KV', async () => {
    mockKV.get.mockResolvedValue({ id: 'test-123', title: 'Cached Content' });

    const req = new Request('http://edge.test/api/content/test-123');
    const res = await worker.fetch(req, mockEnv, mockCtx as unknown as ExecutionContext);

    expect(res.status).toBe(200);
    expect(res.headers.get('X-Edge-Cache')).toBe('HIT');
    
    const body = await res.json() as { title: string; success?: boolean; error?: string };
    expect(body.title).toBe('Cached Content');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should fetch from origin on cache miss and cache the result', async () => {
    mockKV.get.mockResolvedValue(null); // Cache Miss

    const req = new Request('http://edge.test/api/content/test-123');
    const res = await worker.fetch(req, mockEnv, mockCtx as unknown as ExecutionContext);

    expect(res.status).toBe(200);
    expect(res.headers.get('X-Edge-Cache')).toBe('MISS');
    
    const body = await res.json() as { title: string; success?: boolean; error?: string };
    expect(body.title).toBe('Origin Content');
    expect(global.fetch).toHaveBeenCalledWith('http://test.origin/api/content/test-123', expect.any(Object));
    expect(mockCtx.waitUntil).toHaveBeenCalled();
  });

  it('should invalidate cache with correct secret', async () => {
    const { createHmac } = await import('crypto');
    const rawBody = JSON.stringify({ data: { id: 'test-123', locale: 'en' } });
    const signature = createHmac('sha256', 'test-secret').update(rawBody).digest('hex');

    const req = new Request('http://edge.test/internal/invalidate', {
      method: 'POST',
      headers: {
        'X-Rosmarium-Signature': `sha256=${signature}`,
        'Content-Type': 'application/json',
      },
      body: rawBody,
    });

    const res = await worker.fetch(req, mockEnv, mockCtx as unknown as ExecutionContext);
    expect(res.status).toBe(200);

    const body = await res.json() as { title: string; success?: boolean; error?: string };
    expect(body.success).toBe(true);
    expect(mockKV.delete).toHaveBeenCalledWith('content:en:main:test-123');
  });

  it('should reject invalidation with incorrect secret', async () => {
    const req = new Request('http://edge.test/internal/invalidate', {
      method: 'POST',
      headers: {
        'X-Rosmarium-Signature': 'sha256=wrong-signature',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data: { id: 'test-123' } }),
    });

    const res = await worker.fetch(req, mockEnv, mockCtx as unknown as ExecutionContext);
    expect(res.status).toBe(401);
    expect(mockKV.delete).not.toHaveBeenCalled();
  });
});
