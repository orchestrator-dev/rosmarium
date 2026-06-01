import { describe, it, expect, vi, beforeEach } from 'vitest';
import worker from './worker.js';
import { cacheContent, getCachedContent, invalidateCache } from './cache.js';

describe('Edge Worker', () => {
  let mockKV: any;
  let mockEnv: any;
  let mockCtx: any;

  beforeEach(() => {
    mockKV = {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    };

    mockEnv = {
      CONTENT_CACHE: mockKV,
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
    const res = await worker.fetch(req, mockEnv, mockCtx);

    expect(res.status).toBe(200);
    expect(res.headers.get('X-Edge-Cache')).toBe('HIT');
    
    const body = await res.json() as any;
    expect(body.title).toBe('Cached Content');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should fetch from origin on cache miss and cache the result', async () => {
    mockKV.get.mockResolvedValue(null); // Cache Miss

    const req = new Request('http://edge.test/api/content/test-123');
    const res = await worker.fetch(req, mockEnv, mockCtx);

    expect(res.status).toBe(200);
    expect(res.headers.get('X-Edge-Cache')).toBe('MISS');
    
    const body = await res.json() as any;
    expect(body.title).toBe('Origin Content');
    expect(global.fetch).toHaveBeenCalledWith('http://test.origin/api/content/test-123', expect.any(Object));
    expect(mockCtx.waitUntil).toHaveBeenCalled();
  });

  it('should invalidate cache with correct secret', async () => {
    const req = new Request('http://edge.test/internal/invalidate', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test-secret',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ids: ['test-123'], locale: 'en' }),
    });

    const res = await worker.fetch(req, mockEnv, mockCtx);
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body.success).toBe(true);
    expect(mockKV.delete).toHaveBeenCalledWith('content:en:main:test-123');
  });

  it('should reject invalidation with incorrect secret', async () => {
    const req = new Request('http://edge.test/internal/invalidate', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer wrong-secret',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ids: ['test-123'] }),
    });

    const res = await worker.fetch(req, mockEnv, mockCtx);
    expect(res.status).toBe(401);
    expect(mockKV.delete).not.toHaveBeenCalled();
  });
});
