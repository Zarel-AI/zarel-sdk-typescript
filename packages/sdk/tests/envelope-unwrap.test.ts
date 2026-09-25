// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// Transport-level envelope unwrap — codegen-driven.
// The FetchClient consults the per-plane `operations` map (the SINGLE unwrap
// authority) keyed by `operationId`: `{unwrap:true}` strips the canonical
// `{success,data}` envelope to `data`; `{unwrap:false}` returns the body whole;
// an unmapped `operationId` fails fast (ZarelError, never a silent undefined).
import { FetchClient } from '../src/_internal/fetch-client';
import { ZarelAPIError, ZarelError } from '../src/errors';

type MockFetch = jest.Mock<Promise<Response>, [input: string | URL | Request, init?: RequestInit]>;

function mockFetch(status: number, body: unknown, headers?: Record<string, string>): MockFetch {
    return jest.fn<Promise<Response>, [input: string | URL | Request, init?: RequestInit]>().mockResolvedValue({
        ok: status >= 200 && status < 300,
        status,
        statusText: `Status ${status}`,
        json: () => Promise.resolve(body),
        headers: new Headers(headers ?? {}),
    } as Response);
}

// Synthetic per-plane map: one envelope (unwrap) op and one flat/bare (no-unwrap) op.
const OPERATIONS = {
    envOp: { unwrap: true },
    flatOp: { unwrap: false },
} as const;

function createClient(fetchFn: typeof globalThis.fetch): FetchClient {
    return new FetchClient({
        baseUrl: 'https://api.test.com/v1',
        token: 't',
        maxRetries: 0,
        fetch: fetchFn,
        operations: OPERATIONS,
    });
}

describe('FetchClient envelope unwrap (codegen map)', () => {
    it('unwraps {success:true,data} → data when the map says unwrap', async () => {
        const client = createClient(mockFetch(200, { success: true, data: { id: 'e1', name: 'Order' } }));
        const result = await client.get<{ id: string; name: string }>('/x', undefined, { operationId: 'envOp' });
        expect(result).toEqual({ id: 'e1', name: 'Order' });
    });

    it('unwraps {success:true,data:[]} → [] (empty array, not an error)', async () => {
        const client = createClient(mockFetch(200, { success: true, data: [] }));
        const result = await client.get<unknown[]>('/x', undefined, { operationId: 'envOp' });
        expect(result).toEqual([]);
    });

    it('throws ZarelAPIError on {success:false} (2xx envelope failure)', async () => {
        const client = createClient(mockFetch(200, {
            success: false,
            error: { type: 'validation', code: 'BAD', message: 'nope', request_id: 'r1' },
        }));
        await expect(client.get('/x', undefined, { operationId: 'envOp' })).rejects.toBeInstanceOf(ZarelAPIError);
    });

    it('throws ZarelError when the map says unwrap but the body is not an envelope (malformed)', async () => {
        // No boolean `success` → the spec marked this op envelope-wrapped but the
        // wire body is not one. Never a silent `undefined`.
        const client = createClient(mockFetch(200, { id: 'e1', name: 'Order' }));
        await expect(client.get('/x', undefined, { operationId: 'envOp' })).rejects.toBeInstanceOf(ZarelError);
    });

    it('returns a flat-success body unchanged when the map says no-unwrap', async () => {
        const flat = { success: true, message: 'hi', intent_type: 'conversation', data: 'inner' };
        const client = createClient(mockFetch(200, flat));
        expect(await client.get('/x', undefined, { operationId: 'flatOp' })).toEqual(flat);
    });

    it('returns a bare (no-success) body unchanged when the map says no-unwrap', async () => {
        const bare = { id: 'e1', name: 'Order' };
        const client = createClient(mockFetch(200, bare));
        expect(await client.get('/x', undefined, { operationId: 'flatOp' })).toEqual(bare);
    });

    it('fails fast (ZarelError) on an unmapped operationId — never a silent undefined', async () => {
        const client = createClient(mockFetch(200, { success: true, data: { ok: 1 } }));
        await expect(client.get('/x', undefined, { operationId: 'notInMap' })).rejects.toBeInstanceOf(ZarelError);
    });

    it('returns undefined for 204 / empty / non-JSON (before any unwrap)', async () => {
        const c204 = createClient(mockFetch(204, null));
        expect(await c204.del('/x', { operationId: 'flatOp' })).toBeUndefined();
        const cEmpty = createClient(mockFetch(200, null, { 'content-length': '0' }));
        expect(await cEmpty.get('/x', undefined, { operationId: 'envOp' })).toBeUndefined();
        const cText = createClient(mockFetch(200, 'plain', { 'content-type': 'text/plain' }));
        expect(await cText.get('/x', undefined, { operationId: 'envOp' })).toBeUndefined();
    });

    it('unwraps through every helper (get/post/put/patch)', async () => {
        const env = { success: true, data: { ok: 1 } };
        for (const call of [
            (c: FetchClient): Promise<unknown> => c.get('/x', undefined, { operationId: 'envOp' }),
            (c: FetchClient): Promise<unknown> => c.post('/x', {}, { operationId: 'envOp' }),
            (c: FetchClient): Promise<unknown> => c.put('/x', {}, { operationId: 'envOp' }),
            (c: FetchClient): Promise<unknown> => c.patch('/x', {}, { operationId: 'envOp' }),
        ]) {
            const client = createClient(mockFetch(200, env));
            expect(await call(client)).toEqual({ ok: 1 });
        }
    });
});
