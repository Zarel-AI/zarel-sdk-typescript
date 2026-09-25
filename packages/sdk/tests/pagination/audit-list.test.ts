// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// client.runtime.audit.list cursor auto-pagination + query mapping.
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

describe('audit.list — binding_violations', () => {
    afterEach(() => jest.restoreAllMocks());

    it('await returns the first page unchanged and hits the binding path', async () => {
        const fetchFn: MockFetch = jest.fn((input) => {
            const u = new URL(input as string);
            expect(u.pathname).toBe('/v1/runtime/audit/binding_violations');
            return Promise.resolve(jsonResponse({ items: [{ id: 'a', entity: 'Account' }], next_cursor: 'next' }));
        });
        const page = await makeZarel(fetchFn).runtime.audit.list('binding_violations');
        expect(page).toEqual({ items: [{ id: 'a', entity: 'Account' }], next_cursor: 'next' });
        expect(fetchFn.mock.calls).toHaveLength(1);
    });

    it('maps camelCase params to snake_case query (bindingMode → binding_mode)', async () => {
        const fetchFn: MockFetch = jest.fn((input) => {
            const u = new URL(input as string);
            expect(u.searchParams.get('binding_mode')).toBe('immutable');
            expect(u.searchParams.get('entity')).toBe('Account');
            expect(u.searchParams.get('field')).toBe('owner_id');
            expect(u.searchParams.get('limit')).toBe('25');
            return Promise.resolve(jsonResponse({ items: [], next_cursor: null }));
        });
        await makeZarel(fetchFn).runtime.audit.list('binding_violations', {
            entity: 'Account', field: 'owner_id', bindingMode: 'immutable', limit: 25,
        });
        expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('for await auto-paginates across next_cursor to exhaustion', async () => {
        const byCursor: Record<string, { items: Array<{ id: string }>; next_cursor: string | null }> = {
            '': { items: [{ id: 'a' }], next_cursor: 'c1' },
            c1: { items: [{ id: 'b' }], next_cursor: 'c2' },
            c2: { items: [{ id: 'c' }], next_cursor: null },
        };
        const fetchFn: MockFetch = jest.fn((input) => {
            const u = new URL(input as string);
            return Promise.resolve(jsonResponse(byCursor[u.searchParams.get('cursor') ?? '']));
        });
        const ids: string[] = [];
        for await (const row of makeZarel(fetchFn).runtime.audit.list('binding_violations')) ids.push(row.id);
        expect(ids).toEqual(['a', 'b', 'c']);
        expect(fetchFn.mock.calls.map((c) => new URL(c[0] as string).searchParams.get('cursor'))).toEqual([null, 'c1', 'c2']);
    });
});

describe('audit.list — topic_refusals', () => {
    afterEach(() => jest.restoreAllMocks());

    it('maps topic filters to query and hits the topic path', async () => {
        const fetchFn: MockFetch = jest.fn((input) => {
            const u = new URL(input as string);
            expect(u.pathname).toBe('/v1/runtime/audit/topic_refusals');
            expect(u.searchParams.get('category')).toBe('investment_advice');
            expect(u.searchParams.get('reason')).toBe('matched');
            expect(u.searchParams.get('verdict')).toBe('hard_refusal');
            return Promise.resolve(jsonResponse({ items: [{ id: 't', category: 'investment_advice' }], next_cursor: null }));
        });
        const page = await makeZarel(fetchFn).runtime.audit.list('topic_refusals', {
            category: 'investment_advice', reason: 'matched', verdict: 'hard_refusal',
        });
        expect(page.items[0].category).toBe('investment_advice');
    });
});
