// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
import { FetchClient } from '../src/_internal/fetch-client';
import { ZarelAPIError, ZarelAuthError } from '../src/errors';

// ── Helpers ─────────────────────────────────────────────────────────────

type MockFetch = jest.Mock<Promise<Response>, [input: string | URL | Request, init?: RequestInit]>;

function mockFetch(
    status: number,
    body: unknown,
    headers?: Record<string, string>,
): MockFetch {
    return jest.fn<Promise<Response>, [input: string | URL | Request, init?: RequestInit]>().mockResolvedValue({
        ok: status >= 200 && status < 300,
        status,
        statusText: `Status ${status}`,
        json: () => Promise.resolve(body),
        headers: new Headers(headers ?? {}),
    } as Response);
}

const OPS = { testOp: { unwrap: true } } as const;

function createClient(fetchFn: typeof globalThis.fetch, overrides?: Record<string, unknown>): FetchClient {
    return new FetchClient({
        baseUrl: 'https://api.test.com/v1',
        token: 'test-token',
        maxRetries: 0,
        fetch: fetchFn,
        operations: OPS,
        ...overrides,
    });
}

// ── Tests ───────────────────────────────────────────────────────────────

describe('FetchClient', () => {
    it('sends Authorization header', async () => {
        const fetchFn = mockFetch(200, { success: true, data: { ok: true } });
        const client = createClient(fetchFn);

        await client.get('/test', undefined, { operationId: 'testOp' });

        const [, init] = fetchFn.mock.calls[0] as [string, RequestInit];
        const headers = init.headers as Record<string, string>;
        expect(headers['Authorization']).toBe('Bearer test-token');
    });

    // Wire-parity check. A default GET's header set is exactly
    // { Authorization, X-Request-Id } PLUS the single built-in
    // `User-Agent`. No `X-Zarel-Api-Version` (opt-in) and no other additions leak
    // in. This is the backward-compatibility invariant for the default client.
    it('adds only User-Agent to the default header set (parity)', async () => {
        const fetchFn = mockFetch(200, { success: true, data: { ok: true } });
        const client = createClient(fetchFn);

        await client.get('/test', undefined, { operationId: 'testOp' });

        const [, init] = fetchFn.mock.calls[0] as [string, RequestInit];
        const headers = init.headers as Record<string, string>;
        expect(new Set(Object.keys(headers))).toEqual(
            new Set(['Authorization', 'X-Request-Id', 'User-Agent']),
        );
    });

    it('sends X-Request-Id header', async () => {
        const fetchFn = mockFetch(200, { success: true, data: { ok: true } });
        const client = createClient(fetchFn);

        await client.get('/test', undefined, { operationId: 'testOp' });

        const [, init] = fetchFn.mock.calls[0] as [string, RequestInit];
        const headers = init.headers as Record<string, string>;
        const requestId = headers['X-Request-Id'];
        expect(requestId).toBeDefined();
        expect(typeof requestId).toBe('string');
    });

    it('preserves caller-provided X-Request-Id', async () => {
        const fetchFn = mockFetch(200, { success: true, data: { ok: true } });
        const client = createClient(fetchFn);

        await client.request({
            method: 'GET',
            path: '/test',
            operationId: 'testOp',
            headers: { 'X-Request-Id': 'trace-123' },
        });

        const [, init] = fetchFn.mock.calls[0] as [string, RequestInit];
        const headers = init.headers as Record<string, string>;
        expect(headers['X-Request-Id']).toBe('trace-123');
    });

    it('reuses the same X-Request-Id on each retry attempt for one logical request', async () => {
        const fetchFn: MockFetch = jest.fn<Promise<Response>, [input: string | URL | Request, init?: RequestInit]>()
            .mockResolvedValueOnce({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
                json: () => Promise.resolve({
                    error: { type: 'server', code: 'INTERNAL_ERROR', message: 'Oops' },
                }),
                headers: new Headers(),
            } as Response)
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ success: true }),
                headers: new Headers(),
            } as Response);

        const client = new FetchClient({
            baseUrl: 'https://api.test.com/v1',
            token: 'test-token',
            maxRetries: 1,
            retryDelay: 10,
            fetch: fetchFn,
            operations: OPS,
        });

        await client.get('/test', undefined, { operationId: 'testOp' });

        const firstCall = fetchFn.mock.calls[0];
        const secondCall = fetchFn.mock.calls[1];

        expect(firstCall).toBeDefined();
        expect(secondCall).toBeDefined();

        const id1 = (firstCall as [string | URL | Request, RequestInit])[1].headers as Record<string, string>;
        const id2 = (secondCall as [string | URL | Request, RequestInit])[1].headers as Record<string, string>;
        expect(id1['X-Request-Id']).toBeDefined();
        expect(id2['X-Request-Id']).toBeDefined();
        expect(id1['X-Request-Id']).toBe(id2['X-Request-Id']);
    });

    it('sends Idempotency-Key on POST', async () => {
        const fetchFn = mockFetch(200, { success: true, data: { ok: true } });
        const client = createClient(fetchFn);

        await client.post('/test', { data: 1 }, { operationId: 'testOp' });

        const [, init] = fetchFn.mock.calls[0] as [string, RequestInit];
        const headers = init.headers as Record<string, string>;
        expect(headers['Idempotency-Key']).toBeDefined();
    });

    it('does NOT send Idempotency-Key on GET', async () => {
        const fetchFn = mockFetch(200, { success: true, data: { ok: true } });
        const client = createClient(fetchFn);

        await client.get('/test', undefined, { operationId: 'testOp' });

        const [, init] = fetchFn.mock.calls[0] as [string, RequestInit];
        const headers = init.headers as Record<string, string>;
        expect(headers['Idempotency-Key']).toBeUndefined();
    });

    it('builds URL with query parameters', async () => {
        const fetchFn = mockFetch(200, { success: true, data: { ok: true } });
        const client = createClient(fetchFn);

        await client.get('/test', { limit: 10, offset: 0 }, { operationId: 'testOp' });

        const [url] = fetchFn.mock.calls[0] as [string];
        expect(url).toContain('limit=10');
        expect(url).toContain('offset=0');
    });

    it('preserves base path segments (e.g. /v1) in constructed URL', async () => {
        const fetchFn = mockFetch(200, { success: true, data: { ok: true } });
        const client = createClient(fetchFn);

        await client.get('/runtime/tools', undefined, { operationId: 'testOp' });

        const [url] = fetchFn.mock.calls[0] as [string];
        expect(url).toBe('https://api.test.com/v1/runtime/tools');
    });

    it('skips undefined query parameters', async () => {
        const fetchFn = mockFetch(200, { success: true, data: { ok: true } });
        const client = createClient(fetchFn);

        await client.get('/test', { limit: 10, offset: undefined }, { operationId: 'testOp' });

        const [url] = fetchFn.mock.calls[0] as [string];
        expect(url).toContain('limit=10');
        expect(url).not.toContain('offset');
    });

    it('returns the unwrapped data payload on success', async () => {
        const payload = { success: true, data: [1, 2, 3] };
        const fetchFn = mockFetch(200, payload);
        const client = createClient(fetchFn);

        const result = await client.get('/test', undefined, { operationId: 'testOp' });
        expect(result).toEqual([1, 2, 3]);
    });

    it('sends JSON body on POST', async () => {
        const fetchFn = mockFetch(200, { success: true, data: { ok: true } });
        const client = createClient(fetchFn);

        await client.post('/test', { message: 'hello' }, { operationId: 'testOp' });

        const [, init] = fetchFn.mock.calls[0] as [string, RequestInit];
        const headers = init.headers as Record<string, string>;
        expect(headers['Content-Type']).toBe('application/json');
        expect(init.body).toBe(JSON.stringify({ message: 'hello' }));
    });

    describe('error handling', () => {
        it('throws ZarelAuthError on 401', async () => {
            const fetchFn = mockFetch(401, {
                error: { type: 'auth', code: 'UNAUTHORIZED', message: 'Bad token' },
            });
            const client = createClient(fetchFn);

            await expect(client.get('/test', undefined, { operationId: 'testOp' })).rejects.toThrow(ZarelAuthError);
        });

        it('throws ZarelAPIError on 400', async () => {
            const fetchFn = mockFetch(400, {
                error: {
                    type: 'validation',
                    code: 'BAD_REQUEST',
                    message: 'Missing field',
                    request_id: 'req-123',
                },
            });
            const client = createClient(fetchFn);

            try {
                await client.post('/test', {}, { operationId: 'testOp' });
                fail('Expected ZarelAPIError');
            } catch (err) {
                expect(err).toBeInstanceOf(ZarelAPIError);
                const apiErr = err as ZarelAPIError;
                expect(apiErr.status).toBe(400);
                expect(apiErr.type).toBe('validation');
                expect(apiErr.code).toBe('BAD_REQUEST');
                expect(apiErr.requestId).toBe('req-123');
            }
        });

        it('throws ZarelAPIError on 404', async () => {
            const fetchFn = mockFetch(404, {
                error: { type: 'not_found', code: 'NOT_FOUND', message: 'Gone' },
            });
            const client = createClient(fetchFn);

            await expect(client.get('/test', undefined, { operationId: 'testOp' })).rejects.toThrow(ZarelAPIError);
        });

        it('throws ZarelAPIError on 501 (planned endpoint)', async () => {
            const fetchFn = mockFetch(501, {
                error: {
                    type: 'not_implemented',
                    code: 'ENDPOINT_PLANNED',
                    message: 'This endpoint is planned but not yet implemented.',
                },
            });
            const client = createClient(fetchFn);

            try {
                await client.get('/records/tickets', undefined, { operationId: 'testOp' });
                fail('Expected ZarelAPIError');
            } catch (err) {
                expect(err).toBeInstanceOf(ZarelAPIError);
                const apiErr = err as ZarelAPIError;
                expect(apiErr.status).toBe(501);
                expect(apiErr.code).toBe('ENDPOINT_PLANNED');
            }
        });

        it('handles non-JSON error responses', async () => {
            const fetchFn: MockFetch = jest.fn<Promise<Response>, [input: string | URL | Request, init?: RequestInit]>().mockResolvedValue({
                ok: false,
                status: 502,
                statusText: 'Bad Gateway',
                json: () => Promise.reject(new Error('Not JSON')),
                headers: new Headers(),
            } as Response);
            const client = createClient(fetchFn);

            try {
                await client.get('/test', undefined, { operationId: 'testOp' });
                fail('Expected ZarelAPIError');
            } catch (err) {
                expect(err).toBeInstanceOf(ZarelAPIError);
                const apiErr = err as ZarelAPIError;
                expect(apiErr.status).toBe(502);
                expect(apiErr.message).toContain('502');
            }
        });

        // Wire-format extension: the optional `field` on an API error.
        it('constructs ZarelAPIError with explicit field parameter', () => {
            const err = new ZarelAPIError(400, 'invalid_request', 'validation_error', 'msg', 'req_x', 'fieldX');
            expect(err.field).toBe('fieldX');
        });

        it('omits field when constructed without it (backward-compat)', () => {
            const err = new ZarelAPIError(400, 'invalid_request', 'validation_error', 'msg', 'req_x');
            expect(err.field).toBeUndefined();
        });

        it('surfaces body.error.field through the fetch-client into ZarelAPIError', async () => {
            const fetchFn = mockFetch(400, {
                error: {
                    type: 'invalid_request',
                    code: 'validation_error',
                    message: 'Title is too short',
                    request_id: 'req-x',
                    field: 'title',
                },
            });
            const client = createClient(fetchFn);

            try {
                await client.post('/runtime/records/tasks', {}, { operationId: 'testOp' });
                fail('Expected ZarelAPIError');
            } catch (err) {
                expect(err).toBeInstanceOf(ZarelAPIError);
                const apiErr = err as ZarelAPIError;
                expect(apiErr.status).toBe(400);
                expect(apiErr.code).toBe('validation_error');
                expect(apiErr.field).toBe('title');
            }
        });

        it('leaves field undefined when envelope does not carry it', async () => {
            const fetchFn = mockFetch(403, {
                error: {
                    type: 'authorization_error',
                    code: 'insufficient_permissions',
                    message: 'Not allowed',
                    request_id: 'req-y',
                },
            });
            const client = createClient(fetchFn);

            try {
                await client.get('/runtime/records/tasks', undefined, { operationId: 'testOp' });
                fail('Expected ZarelAPIError');
            } catch (err) {
                expect(err).toBeInstanceOf(ZarelAPIError);
                expect((err as ZarelAPIError).field).toBeUndefined();
            }
        });

        // `details` is read off the body the `error` envelope came from. `error` sits
        // BETWEEN the two other keys, so neither "stop at `error`" nor "keep `error`" answers the
        // same object, and each key must carry its own value, not a neighbour's.
        it('carries every top-level key except `error` as details, each with its own value', async () => {
            const fetchFn = mockFetch(409, {
                reseeded_changeset_id: 'cs-9',
                error: { type: 'conflict', code: 'contract_hash_mismatch', message: 'stale' },
                base_hash: 'v8',
            });
            const client = createClient(fetchFn);

            const err: unknown = await client.post('/test', {}, { operationId: 'testOp' }).catch((e: unknown) => e);
            expect(err).toBeInstanceOf(ZarelAPIError);
            expect((err as ZarelAPIError).code).toBe('contract_hash_mismatch');
            expect((err as ZarelAPIError).details).toEqual({ reseeded_changeset_id: 'cs-9', base_hash: 'v8' });
        });

        it('leaves details undefined when the body carries only `error`', async () => {
            const fetchFn = mockFetch(409, {
                error: { type: 'conflict', code: 'contract_hash_mismatch', message: 'stale' },
            });
            const client = createClient(fetchFn);

            const err: unknown = await client.post('/test', {}, { operationId: 'testOp' }).catch((e: unknown) => e);
            expect(err).toBeInstanceOf(ZarelAPIError);
            expect((err as ZarelAPIError).code).toBe('contract_hash_mismatch');
            expect((err as ZarelAPIError).details).toBeUndefined();
        });
    });

    describe('retries', () => {
        it('retries on 500', async () => {
            const fetchFn: MockFetch = jest.fn<Promise<Response>, [input: string | URL | Request, init?: RequestInit]>()
                .mockResolvedValueOnce({
                    ok: false,
                    status: 500,
                    statusText: 'Internal Server Error',
                    json: () => Promise.resolve({
                        error: { type: 'server', code: 'INTERNAL_ERROR', message: 'Oops' },
                    }),
                    headers: new Headers(),
                } as Response)
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({ success: true }),
                    headers: new Headers(),
                } as Response);

            const client = new FetchClient({
                baseUrl: 'https://api.test.com/v1',
                token: 'test-token',
                maxRetries: 1,
                retryDelay: 10,
                fetch: fetchFn,
                operations: OPS,
            });

            const result = await client.get('/test', undefined, { operationId: 'testOp' });
            // 2nd response is {success:true} with no data → unwraps to undefined.
            expect(result).toBeUndefined();
            expect(fetchFn).toHaveBeenCalledTimes(2);
        });

        it('does NOT retry on 400', async () => {
            const fetchFn = mockFetch(400, {
                error: { type: 'validation', code: 'BAD_REQUEST', message: 'Bad' },
            });
            const client = new FetchClient({
                baseUrl: 'https://api.test.com/v1',
                token: 'test-token',
                maxRetries: 2,
                retryDelay: 10,
                fetch: fetchFn,
                operations: OPS,
            });

            await expect(client.get('/test', undefined, { operationId: 'testOp' })).rejects.toThrow(ZarelAPIError);
            expect(fetchFn).toHaveBeenCalledTimes(1);
        });

        it('does NOT retry on 401', async () => {
            const fetchFn = mockFetch(401, {
                error: { type: 'auth', code: 'UNAUTHORIZED', message: 'No' },
            });
            const client = new FetchClient({
                baseUrl: 'https://api.test.com/v1',
                token: 'test-token',
                maxRetries: 2,
                retryDelay: 10,
                fetch: fetchFn,
                operations: OPS,
            });

            await expect(client.get('/test', undefined, { operationId: 'testOp' })).rejects.toThrow(ZarelAuthError);
            expect(fetchFn).toHaveBeenCalledTimes(1);
        });
    });

    // Construction with an empty token does not throw eagerly;
    // missing-token detection happens in require-token.ts at resource-method
    // entry (with plane-specific error codes). FetchClient itself stays
    // generic about token presence and lets the server 401 if used.
    it('accepts empty token at construction (lazy validation by callers)', () => {
        expect(() => new FetchClient({
            baseUrl: 'https://api.test.com/v1',
            token: '',
            fetch: mockFetch(200, {}),
            operations: OPS,
        })).not.toThrow();
    });
});
