import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processingService } from './processing.service.js';
import fs from 'fs/promises';

// Mock sharp
vi.mock('sharp', () => {
  const sharpMock = vi.fn(() => ({
    resize: vi.fn().mockReturnThis(),
    webp: vi.fn().mockReturnThis(),
    avif: vi.fn().mockReturnThis(),
    jpeg: vi.fn().mockReturnThis(),
    png: vi.fn().mockReturnThis(),
    metadata: vi.fn().mockResolvedValue({ width: 1000, height: 1000 }),
    toFile: vi.fn().mockResolvedValue({ size: 100 }),
  }));
  sharpMock.strategy = { attention: 'attention' };
  return { default: sharpMock };
});

vi.mock('fs/promises', () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    access: vi.fn().mockResolvedValue(undefined),
    stat: vi.fn().mockResolvedValue({ size: 100 }),
    open: vi.fn().mockResolvedValue({}),
  }
}));

describe('Processing Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize directories', async () => {
    await processingService.init();
    expect(fs.mkdir).toHaveBeenCalledTimes(2);
  });

  it('should process and cache a new image', async () => {
    // Simulate cache miss
    vi.mocked(fs.stat).mockRejectedValueOnce(new Error('ENOENT'));

    const res = await processingService.processImage('test.jpg', { w: 100, format: 'webp' });
    
    expect(res.mime).toBe('image/webp');
    expect(res.size).toBe(100);
    expect(fs.open).toHaveBeenCalled();
  });

  it('should return cached image if it exists', async () => {
    // Simulate cache hit (fs.stat does not throw)
    const res = await processingService.processImage('test.jpg', { w: 100, format: 'webp' });
    
    expect(res.mime).toBe('image/webp');
    expect(res.size).toBe(100);
    expect(fs.open).toHaveBeenCalled();
  });
});
