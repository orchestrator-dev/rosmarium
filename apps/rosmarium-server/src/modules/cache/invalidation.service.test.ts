import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invalidationService } from './invalidation.service.js';
import { rosmariumEvents } from '../../lib/events.js';

describe('Invalidation Service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, invalidatedCount: 1 })
    });
  });

  it('should invalidate content via fetch to Edge API', async () => {
    await invalidationService.invalidateContent('test-id', 'en');
    
    expect(global.fetch).toHaveBeenCalledWith('http://localhost:8787/internal/invalidate', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        'Content-Type': 'application/json',
        'Authorization': expect.stringContaining('Bearer '),
      }),
      body: JSON.stringify({ ids: ['test-id'], locale: 'en' }),
    }));
  });

  it('should register listeners on init', () => {
    const onSpy = vi.spyOn(rosmariumEvents, 'on');
    invalidationService.init();
    
    expect(onSpy).toHaveBeenCalledWith('content.updated', expect.any(Function));
    expect(onSpy).toHaveBeenCalledWith('content.published', expect.any(Function));
    expect(onSpy).toHaveBeenCalledWith('content.unpublished', expect.any(Function));
    expect(onSpy).toHaveBeenCalledWith('content.deleted', expect.any(Function));
  });
});
