// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// The retry loop honours a server `Retry-After`
// over its exponential backoff, clamped to 60 s, only when a response carries it.
//
// Strategy: fake timers (so no real waiting) + a `setTimeout` spy to read which
// delay the loop SCHEDULED for the pre-retry wait. The per-attempt request
// timeout is set to a distinctive value so it can be filtered out of the spy.
import { FetchClient } from '../src/_internal/fetch-client';

const TIMEOUT = 999_999; // distinctive — filtered out of the sleep-delay reads

function resp(status: number, headers?: Record<string, string>): Response {
    const ok = status >= 200 && status < 300;
    return {
        ok,
        status,
        statusText: `Status ${status}`,
        json: () => Promise.resolve(ok ? { success: true } : { error: { type: 'server', code: 'X', message: 'm' } }),
        headers: new Headers(headers ?? {}),
    } as Response;
}

function client(fetchFn: typeof globalThis.fetch, retryDelay: number, maxRetries = 1): FetchClient {
    return new FetchClient({
        baseUrl: 'https://api.test.com/v1', token: 't',
        maxRetries, retryDelay, timeout: TIMEOUT, fetch: fetchFn,
        operations: { testOp: { unwrap: false } },
    });
}

describe('Retry-After precedence', () => {
    let setTimeoutSpy: jest.SpyInstance;

    beforeEach(() => {
        jest.useFakeTimers({ now: 0 }); // Date.now() === 0 → deterministic HTTP-date math
        setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    });
    afterEach(() => {
        setTimeoutSpy.mockRestore();
        jest.useRealTimers();
    });

    /** The delays scheduled for the pre-retry sleep (everything except the per-attempt timeout). */
    function sleepDelays(): number[] {
        return setTimeoutSpy.mock.calls
            .map((c) => c[1] as number)
            .filter((d) => d !== TIMEOUT);
    }

    it('honours Retry-After (delta-seconds) over exponential backoff', async () => {
        const fetchFn = jest.fn<Promise<Response>, [string | URL | Request, RequestInit?]>()
            .mockResolvedValueOnce(resp(503, { 'Retry-After': '2' }))
            .mockResolvedValueOnce(resp(200));
        const p = client(fetchFn, 50_000).get('/test', undefined, { operationId: 'testOp' });

        await jest.advanceTimersByTimeAsync(2000); // only enough for the header wait, NOT the 50s backoff
        await p;

        expect(fetchFn).toHaveBeenCalledTimes(2);
        expect(sleepDelays()).toContain(2000);
    });

    it('honours Retry-After on a 429', async () => {
        const fetchFn = jest.fn<Promise<Response>, [string | URL | Request, RequestInit?]>()
            .mockResolvedValueOnce(resp(429, { 'Retry-After': '1' }))
            .mockResolvedValueOnce(resp(200));
        const p = client(fetchFn, 50_000).get('/test', undefined, { operationId: 'testOp' });

        await jest.advanceTimersByTimeAsync(1000);
        await p;

        expect(fetchFn).toHaveBeenCalledTimes(2);
        expect(sleepDelays()).toContain(1000);
    });

    it('honours the HTTP-date form', async () => {
        const future = new Date(5000).toUTCString(); // now=0 → delta 5000 ms
        const fetchFn = jest.fn<Promise<Response>, [string | URL | Request, RequestInit?]>()
            .mockResolvedValueOnce(resp(503, { 'Retry-After': future }))
            .mockResolvedValueOnce(resp(200));
        const p = client(fetchFn, 50_000).get('/test', undefined, { operationId: 'testOp' });

        await jest.advanceTimersByTimeAsync(5000);
        await p;

        expect(fetchFn).toHaveBeenCalledTimes(2);
        expect(sleepDelays()).toContain(5000);
    });

    it('clamps a huge Retry-After to the 60 s ceiling and still retries', async () => {
        const fetchFn = jest.fn<Promise<Response>, [string | URL | Request, RequestInit?]>()
            .mockResolvedValueOnce(resp(503, { 'Retry-After': '86400' })) // 1 day
            .mockResolvedValueOnce(resp(200));
        const p = client(fetchFn, 50_000).get('/test', undefined, { operationId: 'testOp' });

        await jest.advanceTimersByTimeAsync(60_000);
        await p;

        expect(fetchFn).toHaveBeenCalledTimes(2);
        expect(sleepDelays()).toContain(60_000);
        expect(sleepDelays()).not.toContain(86_400_000);
    });

    it('falls back to exponential backoff when Retry-After is absent', async () => {
        const fetchFn = jest.fn<Promise<Response>, [string | URL | Request, RequestInit?]>()
            .mockResolvedValueOnce(resp(500)) // no Retry-After
            .mockResolvedValueOnce(resp(200));
        const p = client(fetchFn, 5_000).get('/test', undefined, { operationId: 'testOp' });

        // Not enough for the ~5 s backoff → still one call.
        await jest.advanceTimersByTimeAsync(2000);
        expect(fetchFn).toHaveBeenCalledTimes(1);

        await jest.advanceTimersByTimeAsync(4000); // past the 5 s backoff (+≤10% jitter)
        await p;
        expect(fetchFn).toHaveBeenCalledTimes(2);

        // The scheduled wait was the backoff (>= retryDelay), never a header value.
        expect(sleepDelays().every((d) => d >= 5_000)).toBe(true);
    });

    it('falls back to backoff when Retry-After is unparseable', async () => {
        const fetchFn = jest.fn<Promise<Response>, [string | URL | Request, RequestInit?]>()
            .mockResolvedValueOnce(resp(503, { 'Retry-After': 'soon' }))
            .mockResolvedValueOnce(resp(200));
        const p = client(fetchFn, 5_000).get('/test', undefined, { operationId: 'testOp' });

        await jest.advanceTimersByTimeAsync(2000);
        expect(fetchFn).toHaveBeenCalledTimes(1); // backoff, not honoured
        await jest.advanceTimersByTimeAsync(4000);
        await p;
        expect(fetchFn).toHaveBeenCalledTimes(2);
    });

    it('is NOT consulted on a network error (no response) — backoff applies', async () => {
        const fetchFn = jest.fn<Promise<Response>, [string | URL | Request, RequestInit?]>()
            .mockRejectedValueOnce(new Error('ECONNRESET'))
            .mockResolvedValueOnce(resp(200));
        const p = client(fetchFn, 5_000).get('/test', undefined, { operationId: 'testOp' });

        await jest.advanceTimersByTimeAsync(2000);
        expect(fetchFn).toHaveBeenCalledTimes(1);
        await jest.advanceTimersByTimeAsync(4000);
        await p;
        expect(fetchFn).toHaveBeenCalledTimes(2);
        expect(sleepDelays().every((d) => d >= 5_000)).toBe(true);
    });

    it('re-evaluates Retry-After per attempt', async () => {
        const fetchFn = jest.fn<Promise<Response>, [string | URL | Request, RequestInit?]>()
            .mockResolvedValueOnce(resp(503, { 'Retry-After': '1' }))
            .mockResolvedValueOnce(resp(503, { 'Retry-After': '3' }))
            .mockResolvedValueOnce(resp(200));
        const p = client(fetchFn, 50_000, 2).get('/test', undefined, { operationId: 'testOp' });

        await jest.advanceTimersByTimeAsync(1000);
        expect(fetchFn).toHaveBeenCalledTimes(2);
        await jest.advanceTimersByTimeAsync(3000);
        await p;
        expect(fetchFn).toHaveBeenCalledTimes(3);
        expect(sleepDelays()).toEqual([1000, 3000]);
    });
});
