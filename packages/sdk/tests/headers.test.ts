// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// Built-in identity headers. Every request carries
// `User-Agent: @zarel-ai/sdk/<version>`; `X-Zarel-Api-Version` appears only when
// the consumer sets `apiVersion`.
import { FetchClient } from '../src/_internal/fetch-client';
import { USER_AGENT } from '../src/_internal/version';

type MockFetch = jest.Mock<Promise<Response>, [input: string | URL | Request, init?: RequestInit]>;

function mockFetch(): MockFetch {
    return jest.fn<Promise<Response>, [input: string | URL | Request, init?: RequestInit]>().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.resolve({ success: true, data: { ok: true } }),
        headers: new Headers(),
    } as Response);
}

function headersOf(fetchFn: MockFetch): Record<string, string> {
    const [, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    return init.headers as Record<string, string>;
}

describe('built-in identity headers', () => {
    it('sends User-Agent on every request', async () => {
        const fetchFn = mockFetch();
        const client = new FetchClient({ baseUrl: 'https://api.test.com/v1', token: 't', maxRetries: 0, fetch: fetchFn, operations: { testOp: { unwrap: false } } });

        await client.get('/test', undefined, { operationId: 'testOp' });

        expect(headersOf(fetchFn)['User-Agent']).toBe(USER_AGENT);
        expect(headersOf(fetchFn)['User-Agent']).toMatch(/^@zarel-ai\/sdk\/\d+\.\d+\.\d+$/);
    });

    it('sends User-Agent on POST as well', async () => {
        const fetchFn = mockFetch();
        const client = new FetchClient({ baseUrl: 'https://api.test.com/v1', token: 't', maxRetries: 0, fetch: fetchFn, operations: { testOp: { unwrap: false } } });

        await client.post('/test', { a: 1 }, { operationId: 'testOp' });

        expect(headersOf(fetchFn)['User-Agent']).toBe(USER_AGENT);
    });

    it('sends X-Zarel-Api-Version when apiVersion is set', async () => {
        const fetchFn = mockFetch();
        const client = new FetchClient({
            baseUrl: 'https://api.test.com/v1', token: 't', maxRetries: 0, fetch: fetchFn, operations: { testOp: { unwrap: false } },
            apiVersion: '2026-06-01',
        });

        await client.get('/test', undefined, { operationId: 'testOp' });

        expect(headersOf(fetchFn)['X-Zarel-Api-Version']).toBe('2026-06-01');
    });

    it('omits X-Zarel-Api-Version when apiVersion is not set', async () => {
        const fetchFn = mockFetch();
        const client = new FetchClient({ baseUrl: 'https://api.test.com/v1', token: 't', maxRetries: 0, fetch: fetchFn, operations: { testOp: { unwrap: false } } });

        await client.get('/test', undefined, { operationId: 'testOp' });

        expect(headersOf(fetchFn)['X-Zarel-Api-Version']).toBeUndefined();
    });
});
