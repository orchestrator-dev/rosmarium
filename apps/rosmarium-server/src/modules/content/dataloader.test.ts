import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createContentLoader } from './dataloader.js';
import { contentCacheService } from './cache.service.js';
import { db } from '../../db/index.js';

vi.mock('../../db/index.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([
      { id: '1', data: { name: 'A' } },
      { id: '2', data: { name: 'B' } }
    ])
  }
}));

describe('Content DataLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(contentCacheService, 'mget').mockResolvedValue([null, null]);
    vi.spyOn(contentCacheService, 'mset').mockResolvedValue();
  });

  it('should batch requests and cache results', async () => {
    const loader = createContentLoader();
    const [res1, res2] = await Promise.all([
      loader.load('1'),
      loader.load('2')
    ]);

    expect(db.where).toHaveBeenCalledTimes(1);
    expect(res1).toEqual({ id: '1', data: { name: 'A' } });
    expect(res2).toEqual({ id: '2', data: { name: 'B' } });
    
    expect(contentCacheService.mget).toHaveBeenCalledWith(['1', '2']);
    expect(contentCacheService.mset).toHaveBeenCalledWith([
      { id: '1', data: { name: 'A' } },
      { id: '2', data: { name: 'B' } }
    ]);
  });
});
