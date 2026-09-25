// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// traces.list cursor auto-pagination.
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

describe('traces.list — cursor auto-pagination', () => {
    afterEach(() => jest.restoreAllMocks());

    it('follows next_cursor until null and preserves filters', async () => {
        const byCursor: Record<string, { traces: Array<{ trace_id: string }>; next_cursor: string | null }> = {
            '': { traces: [{ trace_id: 'a' }], next_cursor: 'c1' },
            c1: { traces: [{ trace_id: 'b' }], next_cursor: 'c2' },
            c2: { traces: [{ trace_id: 'c' }], next_cursor: null },
        };
        const fetchFn: MockFetch = jest.fn((input) => {
            const u = new URL(input as string);
            const cursor = u.searchParams.get('cursor') ?? '';
            expect(u.searchParams.get('outcome')).toBe('refused');
            return Promise.resolve(jsonResponse(byCursor[cursor]));
        });
        const zarel = makeZarel(fetchFn);

        const ids: string[] = [];
        for await (const t of zarel.runtime.traces.list({ outcome: 'refused' })) ids.push(t.trace_id);

        expect(ids).toEqual(['a', 'b', 'c']);
        expect(fetchFn.mock.calls.map((c) => new URL(c[0] as string).searchParams.get('cursor'))).toEqual([
            null,
            'c1',
            'c2',
        ]);
    });

    it('await returns the first cursor page unchanged', async () => {
        const fetchFn: MockFetch = jest.fn<Promise<Response>, [input: string | URL | Request, init?: RequestInit]>(() =>
            Promise.resolve(jsonResponse({ traces: [{ trace_id: 'x' }], next_cursor: 'next' })),
        );
        const zarel = makeZarel(fetchFn);
        const page = await zarel.runtime.traces.list();
        expect(page).toEqual({ traces: [{ trace_id: 'x' }], next_cursor: 'next' });
        expect(fetchFn.mock.calls).toHaveLength(1);
    });
});
