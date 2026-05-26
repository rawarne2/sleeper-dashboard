import { describe, it, expect, vi } from 'vitest';
import { pollKtcJobStatus } from '../LeagueContext';

describe('pollKtcJobStatus', () => {
    it('resolves true when job reaches succeeded', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'running' }) })
            .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'running' }) })
            .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'succeeded' }) });

        const result = await pollKtcJobStatus('test-job-id', 0, 20, fetchMock as typeof fetch);
        expect(result).toBe(true);
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('resolves false when job fails', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'failed', error: 'scrape error' }) });

        const result = await pollKtcJobStatus('test-job-id', 0, 20, fetchMock as typeof fetch);
        expect(result).toBe(false);
    });

    it('resolves false after max retries', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValue({ ok: true, json: async () => ({ status: 'running' }) });

        const result = await pollKtcJobStatus('test-job-id', 0, 3, fetchMock as typeof fetch);
        expect(result).toBe(false);
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('resolves false when fetch throws', async () => {
        const fetchMock = vi.fn().mockRejectedValue(new Error('network error'));

        const result = await pollKtcJobStatus('test-job-id', 0, 20, fetchMock as typeof fetch);
        expect(result).toBe(false);
    });
});
