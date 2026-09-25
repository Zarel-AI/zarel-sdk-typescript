// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// records.list auto-pagination over the transport.
import { Zarel } from '../../src/client';
import type { RecordData } from '../../src/types/records';

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

function offsetOf(call: [input: string | URL | Request, init?: RequestInit]): number {
    const u = new URL(call[0] as string);
    return Number(u.searchParams.get('offset') ?? '0');
}

describe('records.list — auto-pagination', () => {
    afterEach(() => jest.restoreAllMocks());

    it('iterates every record across offset pages and stops at total', async () => {
        const pages: Record<number, { records: RecordData[]; total: number }> = {
            0: { records: [{ id: 1 }, { id: 2 }], total: 5 },
            2: { records: [{ id: 3 }, { id: 4 }], total: 5 },
            4: { records: [{ id: 5 }], total: 5 },
        };
        const fetchFn: MockFetch = jest.fn((input) => {
            const u = new URL(input as string);
            const offset = Number(u.searchParams.get('offset') ?? '0');
            return Promise.resolve(jsonResponse(pages[offset]));
        });
        const zarel = makeZarel(fetchFn);

        const ids: unknown[] = [];
        for await (const rec of zarel.runtime.records.list('orders', { limit: 2 })) ids.push(rec.id);

        expect(ids).toEqual([1, 2, 3, 4, 5]);
        expect(fetchFn.mock.calls.map(offsetOf)).toEqual([0, 2, 4]);
    });

    it('preserves filters/sort across pages', async () => {
        const pages: Record<number, { records: RecordData[]; total: number }> = {
            0: { records: [{ id: 1 }], total: 2 },
            1: { records: [{ id: 2 }], total: 2 },
        };
        const fetchFn: MockFetch = jest.fn((input) => {
            const u = new URL(input as string);
            const offset = Number(u.searchParams.get('offset') ?? '0');
            return Promise.resolve(jsonResponse(pages[offset]));
        });
        const zarel = makeZarel(fetchFn);

        const ids: unknown[] = [];
        for await (const rec of zarel.runtime.records.list('orders', {
            limit: 1,
            filters: { status: 'open' },
            sort: [{ field: 'created_at', dir: 'desc' }],
        })) {
            ids.push(rec.id);
        }
        expect(ids).toEqual([1, 2]);
        for (const call of fetchFn.mock.calls) {
            const u = new URL(call[0] as string);
            expect(u.searchParams.get('filters[status]')).toBe('open');
            expect(u.searchParams.get('sort')).toBe(JSON.stringify([{ field: 'created_at', dir: 'desc' }]));
        }
    });

    it('honors a caller-supplied initial offset for page 1', async () => {
        const fetchFn: MockFetch = jest.fn<Promise<Response>, [input: string | URL | Request, init?: RequestInit]>(() =>
            Promise.resolve(jsonResponse({ records: [{ id: 99 }], total: 51 })),
        );
        const zarel = makeZarel(fetchFn);
        // total 51, start offset 50, page returns 1 → consumed 51 ≥ total → stop after one fetch.
        const ids: unknown[] = [];
        for await (const rec of zarel.runtime.records.list('orders', { limit: 1, offset: 50 })) ids.push(rec.id);
        expect(ids).toEqual([99]);
        const [firstCall] = fetchFn.mock.calls;
        if (!firstCall) throw new Error('expected one fetch call');
        expect(offsetOf(firstCall)).toBe(50);
        expect(fetchFn.mock.calls).toHaveLength(1);
    });

    it('await still returns the first single page unchanged', async () => {
        const fetchFn: MockFetch = jest.fn<Promise<Response>, [input: string | URL | Request, init?: RequestInit]>(() =>
            Promise.resolve(jsonResponse({ records: [{ id: 1 }, { id: 2 }], total: 2 })),
        );
        const zarel = makeZarel(fetchFn);
        const page = await zarel.runtime.records.list('orders', { limit: 2 });
        expect(page).toEqual({ records: [{ id: 1 }, { id: 2 }], total: 2 });
        expect(fetchFn.mock.calls).toHaveLength(1);
    });
});
