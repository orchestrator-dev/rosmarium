import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyticsClient } from './analytics.client';

describe('AnalyticsClient', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        global.fetch = vi.fn();
    });

    it('should fetch entry analytics', async () => {
        const mockData = {
            pagerankScore: 0.1,
            betweennessScore: 0.2,
            communityId: 1,
            hubScore: 0.3,
            authorityScore: 0.4,
            degreeIn: 5,
            degreeOut: 3,
            computedAt: new Date().toISOString()
        };

        (global.fetch as vi.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => mockData
        });

        const res = await analyticsClient.getEntryAnalytics('test-id');
        expect(res).toEqual(mockData);
        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/graph/analytics/test-id'),
            expect.any(Object)
        );
    });

    it('should queue analytics compute', async () => {
        (global.fetch as vi.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => ({ status: 'queued' })
        });

        await analyticsClient.triggerCompute();
        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/graph/analytics/compute'),
            expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({
                    'X-Worker-Secret': expect.any(String),
                    'Content-Type': 'application/json'
                })
            })
        );
    });

    it('should throw on export error', async () => {
        (global.fetch as vi.Mock).mockResolvedValueOnce({
            ok: false,
            status: 400,
            text: async () => 'Bad Request'
        });

        await expect(analyticsClient.exportGraph({ format: 'json-ld' })).rejects.toThrow('AI worker returned 400: Bad Request');
    });
});

