// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
import { Zarel } from '../src/client';
import type { FilterExpr, SortSpec } from '../src/types/records';

type MockFetch = jest.Mock<Promise<Response>, [input: string | URL | Request, init?: RequestInit]>;

function createZarelWithMock(): { zarel: Zarel; fetchFn: MockFetch } {
    const fetchFn: MockFetch = jest.fn<Promise<Response>, [input: string | URL | Request, init?: RequestInit]>().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, data: { records: [], total: 0 } }),
        headers: new Headers(),
    } as Response);
    const zarel = new Zarel({
        runtimeToken: 'test-token',
        runtimeBaseUrl: 'https://api.test.com/v1',
        maxRetries: 0,
        fetch: fetchFn,
    });
    return { zarel, fetchFn };
}

function url(fetchFn: MockFetch): URL {
    const call = fetchFn.mock.calls[0];
    if (!call) throw new Error('expected one fetch call');
    return new URL(call[0] as string);
}

describe('records.list — serialisation', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('serialises scalar filters flat', async () => {
        const { zarel, fetchFn } = createZarelWithMock();
        await zarel.runtime.records.list('tasks', {
            filters: { priority: 'high', completed: false, qty: 5 },
        });
        const u = url(fetchFn);
        expect(u.searchParams.get('filters[priority]')).toBe('high');
        expect(u.searchParams.get('filters[completed]')).toBe('false');
        expect(u.searchParams.get('filters[qty]')).toBe('5');
    });

    it('serialises FilterExpr filters as JSON-encoded values', async () => {
        const { zarel, fetchFn } = createZarelWithMock();
        const expr: FilterExpr = { op: 'contains', value: 'urgent' };
        await zarel.runtime.records.list('tasks', { filters: { title: expr } });
        const u = url(fetchFn);
        expect(u.searchParams.get('filters[title]')).toBe(JSON.stringify(expr));
    });

    it('serialises FilterExpr[] filters as JSON-encoded values (AND within field)', async () => {
        const { zarel, fetchFn } = createZarelWithMock();
        const exprs: FilterExpr[] = [
            { op: 'gte', value: 5 },
            { op: 'lte', value: 10 },
        ];
        await zarel.runtime.records.list('tasks', { filters: { qty: exprs } });
        const u = url(fetchFn);
        expect(u.searchParams.get('filters[qty]')).toBe(JSON.stringify(exprs));
    });

    it('serialises sort: SortSpec[] as JSON-encoded value', async () => {
        const { zarel, fetchFn } = createZarelWithMock();
        const sort: SortSpec[] = [
            { field: 'priority', dir: 'desc' },
            { field: 'created_at', dir: 'asc' },
        ];
        await zarel.runtime.records.list('tasks', { sort });
        const u = url(fetchFn);
        expect(u.searchParams.get('sort')).toBe(JSON.stringify(sort));
    });

    it('omits sort param when sort is empty array (treated as no sort)', async () => {
        const { zarel, fetchFn } = createZarelWithMock();
        await zarel.runtime.records.list('tasks', { sort: [] });
        const u = url(fetchFn);
        expect(u.searchParams.get('sort')).toBeNull();
    });

    it('skips null/undefined filter values', async () => {
        const { zarel, fetchFn } = createZarelWithMock();
        await zarel.runtime.records.list('tasks', {
            filters: {
                priority: 'high',
                title: undefined as unknown as string,
                qty: null as unknown as number,
            },
        });
        const u = url(fetchFn);
        expect(u.searchParams.get('filters[priority]')).toBe('high');
        expect(u.searchParams.get('filters[title]')).toBeNull();
        expect(u.searchParams.get('filters[qty]')).toBeNull();
    });
});
