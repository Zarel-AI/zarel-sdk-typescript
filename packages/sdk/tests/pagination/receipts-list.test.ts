// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// client.runtime.receipts.list envelope-unwrap, query mapping,
// and cursor auto-pagination. Mirrors the audit.list pagination test.
import { Zarel } from '../../src/client';

type MockFetch = jest.Mock<Promise<Response>, [input: string | URL | Request, init?: RequestInit]>;

function jsonResponse(data: unknown): Response {
    return {
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, data }),
        headers: new Headers(),
    } as Response;
}

function makeZarel(fetchFn: MockFetch): Zarel {
    return new Zarel({
        runtimeToken: 'test-token',
        runtimeBaseUrl: 'https://api.test.com/v1',
        maxRetries: 0,
        fetch: fetchFn,
    });
}

describe('receipts.list', () => {
    afterEach(() => jest.restoreAllMocks());

    it('await returns the first page unchanged and hits /runtime/receipts', async () => {
        const fetchFn: MockFetch = jest.fn((input) => {
            const u = new URL(input as string);
            expect(u.pathname).toBe('/v1/runtime/receipts');
            return Promise.resolve(jsonResponse({
                items: [{ id: 'refusal:a', signal: 'refusal' }], next_cursor: 'next',
            }));
        });
        const page = await makeZarel(fetchFn).runtime.receipts.list();
        expect(page).toEqual({ items: [{ id: 'refusal:a', signal: 'refusal' }], next_cursor: 'next' });
        expect(fetchFn.mock.calls).toHaveLength(1);
    });

    it('maps signal/trace_id/from/to/limit to the query string', async () => {
        const fetchFn: MockFetch = jest.fn((input) => {
            const u = new URL(input as string);
            expect(u.searchParams.get('signal')).toBe('binding_violation');
            expect(u.searchParams.get('trace_id')).toBe('trc_1');
            expect(u.searchParams.get('from')).toBe('2026-06-01T00:00:00.000Z');
            expect(u.searchParams.get('to')).toBe('2026-06-30T00:00:00.000Z');
            expect(u.searchParams.get('limit')).toBe('25');
            return Promise.resolve(jsonResponse({ items: [], next_cursor: null }));
        });
        await makeZarel(fetchFn).runtime.receipts.list({
            signal: 'binding_violation', trace_id: 'trc_1',
            from: '2026-06-01T00:00:00.000Z', to: '2026-06-30T00:00:00.000Z', limit: 25,
        });
        expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('for await auto-paginates across next_cursor to exhaustion', async () => {
        const byCursor: Record<string, { items: Array<{ id: string }>; next_cursor: string | null }> = {
            '': { items: [{ id: 'refusal:a' }], next_cursor: 'c1' },
            c1: { items: [{ id: 'binding_violation:b' }], next_cursor: 'c2' },
            c2: { items: [{ id: 'validation_violation:c' }], next_cursor: null },
        };
        const fetchFn: MockFetch = jest.fn((input) => {
            const u = new URL(input as string);
            return Promise.resolve(jsonResponse(byCursor[u.searchParams.get('cursor') ?? '']));
        });
        const ids: string[] = [];
        for await (const row of makeZarel(fetchFn).runtime.receipts.list()) ids.push(row.id);
        expect(ids).toEqual(['refusal:a', 'binding_violation:b', 'validation_violation:c']);
        expect(fetchFn.mock.calls.map((c) => new URL(c[0] as string).searchParams.get('cursor'))).toEqual([null, 'c1', 'c2']);
    });
});
