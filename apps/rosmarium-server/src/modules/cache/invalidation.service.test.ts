import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invalidationService } from './invalidation.service.js';
import { rosmariumEvents } from '../../lib/events.js';
import * as webhookQueue from '../webhooks/webhook.queue.js';

describe('Invalidation Service', () => {
  let mockAdd: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetAllMocks();
    mockAdd = vi.fn().mockResolvedValue({});
    vi.spyOn(webhookQueue, 'getWebhookQueue').mockReturnValue({ add: mockAdd } as any);
  });

  it('should invalidate content via webhook queue', async () => {
    await invalidationService.invalidateContent('test-id', 'en');

    expect(mockAdd).toHaveBeenCalledWith("deliver", expect.objectContaining({
        systemWebhook: expect.objectContaining({ url: 'http://localhost:8787/internal/invalidate' }),
        event: "entry.updated",
        contentType: "system",
        payload: { id: "test-id", locale: "en" },
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
