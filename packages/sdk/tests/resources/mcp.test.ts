// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// runtime.mcp.call transport behavior.
import { Zarel } from '../../src/client';
import { ZarelAuthError, ZarelAPIError, ZarelError } from '../../src/errors';

const RUNTIME_BASE = 'https://acme.example.com/v1';

interface MockResponseInit {
    ok?: boolean;
    status?: number;
    contentType?: string;
    text?: string;
    json?: unknown;
}

function mockResponse(init: MockResponseInit): Response {
    const headers = new Headers(init.contentType ? { 'content-type': init.contentType } : {});
    return {
        ok: init.ok ?? true,
        status: init.status ?? 200,
        headers,
        text: () => Promise.resolve(init.text ?? ''),
        json: () => Promise.resolve(init.json ?? {}),
    } as Response;
}

function makeClient(fetchFn: jest.Mock, overrides?: Record<string, unknown>): Zarel {
    return new Zarel({
        runtimeToken: 'rt-token',
        contractToken: 'ct-token',
        runtimeBaseUrl: RUNTIME_BASE,
        contractBaseUrl: 'https://acme.admin.example.com/v1',
        maxRetries: 0,
        fetch: fetchFn as unknown as typeof fetch,
        ...overrides,
    });
}

const PING = { jsonrpc: '2.0', id: 1, method: 'tools/list' } as const;

describe('runtime.mcp.call — happy paths', () => {
    it('parses an application/json JSON-RPC response', async () => {
        const fetchFn = jest.fn().mockResolvedValue(mockResponse({
            contentType: 'application/json',
            text: JSON.stringify({ jsonrpc: '2.0', id: 1, result: { tools: ['a'] } }),
        }));
        const res = await makeClient(fetchFn).runtime.mcp.call(PING);
        expect('error' in res).toBe(false);
        if (!('error' in res)) expect(res.result).toEqual({ tools: ['a'] });
        // POSTs to the real path with the right Accept.
        const [url, init] = fetchFn.mock.calls[0];
        expect(new URL(url as string).pathname).toBe('/v1/runtime/mcp');
        expect((init as RequestInit).method).toBe('POST');
        expect((init as { headers: Record<string, string> }).headers['Accept']).toContain('text/event-stream');
    });

    it('de-frames a single text/event-stream message frame', async () => {
        const fetchFn = jest.fn().mockResolvedValue(mockResponse({
            contentType: 'text/event-stream',
            text: `event: message\ndata: ${JSON.stringify({ jsonrpc: '2.0', id: 1, result: 42 })}\n\n`,
        }));
        const res = await makeClient(fetchFn).runtime.mcp.call(PING);
        if (!('error' in res)) expect(res.result).toBe(42);
    });

    it('returns a protocol-level JSON-RPC error in the union (not thrown)', async () => {
        const fetchFn = jest.fn().mockResolvedValue(mockResponse({
            contentType: 'application/json',
            text: JSON.stringify({ jsonrpc: '2.0', id: 1, error: { code: -32601, message: 'nope' } }),
        }));
        const res = await makeClient(fetchFn).runtime.mcp.call(PING);
        expect('error' in res).toBe(true);
        if ('error' in res) expect(res.error.code).toBe(-32601);
    });

    it('rejects with ZarelError on a malformed body', async () => {
        const fetchFn = jest.fn().mockResolvedValue(mockResponse({
            contentType: 'application/json',
            text: JSON.stringify({ success: true, data: {} }),
        }));
        await expect(makeClient(fetchFn).runtime.mcp.call(PING)).rejects.toBeInstanceOf(ZarelError);
    });
});

describe('runtime.mcp.call — transport-error semantics', () => {
    it('throws ZarelAuthError on 401', async () => {
        const fetchFn = jest.fn().mockResolvedValue(mockResponse({
            ok: false, status: 401, contentType: 'application/json',
            text: JSON.stringify({ error: { type: 'auth', code: 'UNAUTHORIZED', message: 'no' } }),
            json: { error: { type: 'auth', code: 'UNAUTHORIZED', message: 'no' } },
        }));
        await expect(makeClient(fetchFn).runtime.mcp.call(PING)).rejects.toBeInstanceOf(ZarelAuthError);
    });

    it('throws ZarelAPIError on a 5xx and does NOT retry (single attempt)', async () => {
        const fetchFn = jest.fn().mockResolvedValue(mockResponse({
            ok: false, status: 503, contentType: 'application/json',
            json: { error: { type: 'server', code: 'UNAVAILABLE', message: 'busy' } },
        }));
        await expect(makeClient(fetchFn, { maxRetries: 3 }).runtime.mcp.call(PING)).rejects.toBeInstanceOf(ZarelAPIError);
        expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('omits Authorization and includes credentials when transport-managed', async () => {
        const fetchFn = jest.fn().mockResolvedValue(mockResponse({
            contentType: 'application/json',
            text: JSON.stringify({ jsonrpc: '2.0', id: 1, result: {} }),
        }));
        // Transport-managed: no token, credential-injecting proxy.
        const zarel = new Zarel({
            runtimeBaseUrl: RUNTIME_BASE,
            contractBaseUrl: 'https://acme.admin.example.com/v1',
            transportManaged: true,
            maxRetries: 0,
            fetch: fetchFn as unknown as typeof fetch,
        });
        await zarel.runtime.mcp.call(PING);
        const init = fetchFn.mock.calls[0][1] as RequestInit & { headers: Record<string, string> };
        expect(init.headers['Authorization']).toBeUndefined();
        expect(init.credentials).toBe('include');
    });

    it('rejects before any network I/O when a direct client has no runtime token', async () => {
        const fetchFn = jest.fn();
        const zarel = new Zarel({
            runtimeBaseUrl: RUNTIME_BASE,
            contractBaseUrl: 'https://acme.admin.example.com/v1',
            maxRetries: 0,
            fetch: fetchFn as unknown as typeof fetch,
        });
        await expect(zarel.runtime.mcp.call(PING)).rejects.toBeInstanceOf(ZarelAuthError);
        expect(fetchFn).not.toHaveBeenCalled();
    });
});
