// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// Per-attempt request/response/error interceptors.
import { FetchClient } from '../src/_internal/fetch-client';
import type { Interceptors } from '../src/_internal/interceptors';
import { ZarelAPIError } from '../src/errors';

function okResp(): Response {
    return {
        ok: true, status: 200, statusText: 'OK',
        json: () => Promise.resolve({ success: true, data: { ok: true } }),
        headers: new Headers(),
    } as Response;
}
function errResp(status: number): Response {
    return {
        ok: false, status, statusText: `Status ${status}`,
        json: () => Promise.resolve({ error: { type: 'server', code: 'X', message: 'm' } }),
        headers: new Headers(),
    } as Response;
}

function makeClient(fetchFn: typeof globalThis.fetch, interceptors: Interceptors, maxRetries = 0): FetchClient {
    return new FetchClient({
        baseUrl: 'https://api.test.com/v1', token: 'tok',
        maxRetries, retryDelay: 5, fetch: fetchFn, interceptors,
        operations: { testOp: { unwrap: true } },
    });
}

function singleOk(): jest.Mock<Promise<Response>, [string | URL | Request, RequestInit?]> {
    return jest.fn<Promise<Response>, [string | URL | Request, RequestInit?]>().mockResolvedValue(okResp());
}

describe('interceptors', () => {
    it('onRequest mutation reaches the wire', async () => {
        const fetchFn = singleOk();
        const client = makeClient(fetchFn, {
            onRequest: (ctx) => { ctx.headers['X-Trace-Id'] = 'trace-abc'; },
        });

        await client.get('/test', undefined, { operationId: 'testOp' });

        const [, init] = fetchFn.mock.calls[0] as [string, RequestInit];
        expect((init.headers as Record<string, string>)['X-Trace-Id']).toBe('trace-abc');
    });

    it('onRequest runs after auth + idempotency + identity headers are assembled', async () => {
        const fetchFn = singleOk();
        let seen: Record<string, string> = {};
        const client = makeClient(fetchFn, {
            onRequest: (ctx) => { seen = { ...ctx.headers }; },
        });

        await client.post('/test', { a: 1 }, { operationId: 'testOp' });

        expect(seen['Authorization']).toBe('Bearer tok');
        expect(seen['Idempotency-Key']).toBeDefined();
        expect(seen['User-Agent']).toMatch(/^@zarel-ai\/sdk\//);
    });

    it('passes the 0-based attempt number', async () => {
        const fetchFn = singleOk();
        const onRequest = jest.fn();
        await makeClient(fetchFn, { onRequest }).get('/test', undefined, { operationId: 'testOp' });
        expect(onRequest).toHaveBeenCalledWith(expect.objectContaining({ attempt: 0, method: 'GET' }));
    });

    describe('per-attempt firing counts & mutual exclusivity', () => {
        it('2xx → onRequest 1, onResponse 1, onError 0', async () => {
            const fetchFn = singleOk();
            const onRequest = jest.fn(); const onResponse = jest.fn(); const onError = jest.fn();
            await makeClient(fetchFn, { onRequest, onResponse, onError }).get('/test', undefined, { operationId: 'testOp' });
            expect(onRequest).toHaveBeenCalledTimes(1);
            expect(onResponse).toHaveBeenCalledTimes(1);
            expect(onResponse).toHaveBeenCalledWith(expect.objectContaining({ status: 200 }));
            expect(onError).toHaveBeenCalledTimes(0);
        });

        it('retryable 503 then 2xx → onRequest 2, onResponse 2, onError 0', async () => {
            const fetchFn = jest.fn<Promise<Response>, [string | URL | Request, RequestInit?]>()
                .mockResolvedValueOnce(errResp(503))
                .mockResolvedValueOnce(okResp());
            const onRequest = jest.fn(); const onResponse = jest.fn(); const onError = jest.fn();
            await makeClient(fetchFn, { onRequest, onResponse, onError }, 1).get('/test', undefined, { operationId: 'testOp' });
            expect(onRequest).toHaveBeenCalledTimes(2);
            expect(onResponse).toHaveBeenCalledTimes(2);
            expect(onResponse.mock.calls.map((c) => (c[0] as { status: number }).status)).toEqual([503, 200]);
            expect(onError).toHaveBeenCalledTimes(0);
        });

        it('network error then 2xx → onRequest 2, onResponse 1, onError 1', async () => {
            const fetchFn = jest.fn<Promise<Response>, [string | URL | Request, RequestInit?]>()
                .mockRejectedValueOnce(new Error('ECONNRESET'))
                .mockResolvedValueOnce(okResp());
            const onRequest = jest.fn(); const onResponse = jest.fn(); const onError = jest.fn();
            await makeClient(fetchFn, { onRequest, onResponse, onError }, 1).get('/test', undefined, { operationId: 'testOp' });
            expect(onRequest).toHaveBeenCalledTimes(2);
            expect(onResponse).toHaveBeenCalledTimes(1);
            expect(onResponse).toHaveBeenCalledWith(expect.objectContaining({ status: 200 }));
            expect(onError).toHaveBeenCalledTimes(1);
        });

        it('non-retryable 400 → onResponse fires (status 400), onError 0', async () => {
            const fetchFn = jest.fn<Promise<Response>, [string | URL | Request, RequestInit?]>()
                .mockResolvedValue(errResp(400));
            const onResponse = jest.fn(); const onError = jest.fn();
            await expect(makeClient(fetchFn, { onResponse, onError }).get('/test', undefined, { operationId: 'testOp' })).rejects.toThrow(ZarelAPIError);
            expect(onResponse).toHaveBeenCalledTimes(1);
            expect(onResponse).toHaveBeenCalledWith(expect.objectContaining({ status: 400 }));
            expect(onError).toHaveBeenCalledTimes(0);
        });

        it('2xx with an unparseable JSON body → onResponse fires, onError 0 (mutual exclusivity)', async () => {
            // A response WAS received (status 200 → onResponse), but the body
            // fails to JSON-parse (a plain SyntaxError, not a ZarelError). This
            // must NOT also fire onError — the two are mutually exclusive per
            // attempt.
            const badJson = {
                ok: true, status: 200, statusText: 'OK',
                json: () => Promise.reject(new SyntaxError('Unexpected token')),
                headers: new Headers(),
            } as Response;
            const fetchFn = jest.fn<Promise<Response>, [string | URL | Request, RequestInit?]>()
                .mockResolvedValue(badJson);
            const onResponse = jest.fn(); const onError = jest.fn();
            await expect(makeClient(fetchFn, { onResponse, onError }).get('/test', undefined, { operationId: 'testOp' })).rejects.toThrow();
            expect(onResponse).toHaveBeenCalledTimes(1);
            expect(onResponse).toHaveBeenCalledWith(expect.objectContaining({ status: 200 }));
            expect(onError).toHaveBeenCalledTimes(0);
        });

        it('401 → onResponse fires (status 401), onError 0', async () => {
            const fetchFn = jest.fn<Promise<Response>, [string | URL | Request, RequestInit?]>()
                .mockResolvedValue(errResp(401));
            const onResponse = jest.fn(); const onError = jest.fn();
            await expect(makeClient(fetchFn, { onResponse, onError }).get('/test', undefined, { operationId: 'testOp' })).rejects.toThrow();
            expect(onResponse).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
            expect(onError).toHaveBeenCalledTimes(0);
        });
    });

    describe('error semantics', () => {
        it('onRequest throw aborts the request — no fetch, error surfaces', async () => {
            const fetchFn = singleOk();
            const boom = new Error('circuit open');
            const client = makeClient(fetchFn, { onRequest: () => { throw boom; } });
            await expect(client.get('/test', undefined, { operationId: 'testOp' })).rejects.toBe(boom);
            expect(fetchFn).not.toHaveBeenCalled();
        });

        it('onResponse throw is swallowed — request still resolves', async () => {
            const fetchFn = singleOk();
            const client = makeClient(fetchFn, { onResponse: () => { throw new Error('hook bug'); } });
            await expect(client.get('/test', undefined, { operationId: 'testOp' })).resolves.toEqual({ ok: true });
        });

        it('onError throw is swallowed — original error still surfaces', async () => {
            const fetchFn = jest.fn<Promise<Response>, [string | URL | Request, RequestInit?]>()
                .mockRejectedValue(new Error('ECONNRESET'));
            const client = makeClient(fetchFn, { onError: () => { throw new Error('hook bug'); } });
            await expect(client.get('/test', undefined, { operationId: 'testOp' })).rejects.toThrow('ECONNRESET');
        });

        it('caller abort does NOT fire onError', async () => {
            // A genuine caller abort: the consumer's own AbortSignal is already
            // aborted. The transport throws an AbortError before any fetch and
            // never reaches the onError path. (An AbortError WITHOUT a caller
            // signal is the internal timeout controller → a no-response failure
            // → onError correctly fires; that is the timeout case, not abort.)
            const fetchFn = singleOk();
            const onError = jest.fn();
            const controller = new AbortController();
            controller.abort();
            const client = makeClient(fetchFn, { onError });
            await expect(client.get('/test', undefined, { operationId: 'testOp', signal: controller.signal })).rejects.toThrow();
            expect(onError).toHaveBeenCalledTimes(0);
            expect(fetchFn).not.toHaveBeenCalled();
        });
    });

    it('awaits async hooks', async () => {
        const fetchFn = singleOk();
        const client = makeClient(fetchFn, {
            onRequest: async (ctx) => { await Promise.resolve(); ctx.headers['X-Async'] = 'yes'; },
        });
        await client.get('/test', undefined, { operationId: 'testOp' });
        const [, init] = fetchFn.mock.calls[0] as [string, RequestInit];
        expect((init.headers as Record<string, string>)['X-Async']).toBe('yes');
    });
});
