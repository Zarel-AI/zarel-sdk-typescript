// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// Strategies + iteration semantics.
import {
    PagePromise,
    offsetWithTotal,
    cursorBased,
    bareArrayOffset,
    type PageParams,
    type PaginationStrategy,
} from '../../src/_internal/pagination';

// ── offsetWithTotal ────────────────────────────────────────────────────────

interface OffsetPage {
    records: number[];
    total: number;
}

function offsetFetcher(pages: OffsetPage[]): {
    fetchPage: (p: PageParams) => Promise<OffsetPage>;
    requestedOffsets: number[];
} {
    const requestedOffsets: number[] = [];
    let index = 0;
    return {
        fetchPage: (p: PageParams): Promise<OffsetPage> => {
            requestedOffsets.push(p.offset ?? 0);
            const page = pages[index] ?? { records: [], total: pages[0]?.total ?? 0 };
            index++;
            return Promise.resolve(page);
        },
        requestedOffsets,
    };
}

async function collect<T>(it: AsyncIterable<T>): Promise<T[]> {
    const out: T[] = [];
    for await (const x of it) out.push(x);
    return out;
}

describe('offsetWithTotal strategy', () => {
    const strat = (): PaginationStrategy<OffsetPage, number> => offsetWithTotal<OffsetPage, number>((p) => p.records, (p) => p.total);

    it('paginates multiple pages and stops at total', async () => {
        const { fetchPage, requestedOffsets } = offsetFetcher([
            { records: [1, 2], total: 5 },
            { records: [3, 4], total: 5 },
            { records: [5], total: 5 },
        ]);
        const items = await collect(new PagePromise(fetchPage, strat(), { offset: 0 }));
        expect(items).toEqual([1, 2, 3, 4, 5]);
        expect(requestedOffsets).toEqual([0, 2, 4]); // advances by lastCount
    });

    it('stops with no trailing fetch when total is an exact multiple', async () => {
        const { fetchPage, requestedOffsets } = offsetFetcher([
            { records: [1, 2], total: 4 },
            { records: [3, 4], total: 4 },
        ]);
        const items = await collect(new PagePromise(fetchPage, strat(), { offset: 0 }));
        expect(items).toEqual([1, 2, 3, 4]);
        expect(requestedOffsets).toEqual([0, 2]); // no third fetch — consumed === total
    });

    it('yields nothing for an empty first page', async () => {
        const { fetchPage, requestedOffsets } = offsetFetcher([{ records: [], total: 0 }]);
        const items = await collect(new PagePromise(fetchPage, strat(), { offset: 0 }));
        expect(items).toEqual([]);
        expect(requestedOffsets).toEqual([0]);
    });
});

// ── cursorBased ──────────────────────────────────────────────────────────

interface CursorPage {
    traces: string[];
    next_cursor: string | null;
}

describe('cursorBased strategy', () => {
    const strat = (): PaginationStrategy<CursorPage, string> => cursorBased<CursorPage, string>((p) => p.traces, (p) => p.next_cursor);

    it('follows next_cursor until null', async () => {
        const seenCursors: Array<string | undefined> = [];
        const pages: CursorPage[] = [
            { traces: ['a'], next_cursor: 'c1' },
            { traces: ['b'], next_cursor: 'c2' },
            { traces: ['c'], next_cursor: null },
        ];
        let i = 0;
        const fetchPage = (p: PageParams): Promise<CursorPage> => {
            seenCursors.push(p.cursor);
            const page = pages[i++];
            if (!page) throw new Error('unexpected extra fetch');
            return Promise.resolve(page);
        };
        const items = await collect(new PagePromise(fetchPage, strat(), {}));
        expect(items).toEqual(['a', 'b', 'c']);
        expect(seenCursors).toEqual([undefined, 'c1', 'c2']);
    });

    it('treats undefined cursor as terminal (loose ==)', async () => {
        const fetchPage = (): Promise<CursorPage> =>
            Promise.resolve({ traces: ['only'], next_cursor: undefined as unknown as null });
        const items = await collect(new PagePromise(fetchPage, strat(), {}));
        expect(items).toEqual(['only']);
    });
});

// ── bareArrayOffset ────────────────────────────────────────────────────────

describe('bareArrayOffset strategy', () => {
    function bareFetcher(pages: number[][]): {
        fetchPage: (p: PageParams) => Promise<number[]>;
        requestedOffsets: number[];
    } {
        const requestedOffsets: number[] = [];
        let i = 0;
        return {
            fetchPage: (p: PageParams): Promise<number[]> => {
                requestedOffsets.push(p.offset ?? 0);
                return Promise.resolve(pages[i++] ?? []);
            },
            requestedOffsets,
        };
    }

    it('adopts the first-page size and stops on a short page', async () => {
        const { fetchPage, requestedOffsets } = bareFetcher([[1, 2, 3], [4, 5]]);
        const items = await collect(new PagePromise(fetchPage, bareArrayOffset<number>(), { offset: 0 }));
        expect(items).toEqual([1, 2, 3, 4, 5]); // page2 (2) < pageSize (3) → stop
        expect(requestedOffsets).toEqual([0, 3]);
    });

    it('does one trailing empty fetch when the count is an exact multiple', async () => {
        const { fetchPage, requestedOffsets } = bareFetcher([[1, 2], [3, 4], []]);
        const items = await collect(new PagePromise(fetchPage, bareArrayOffset<number>(), { offset: 0 }));
        expect(items).toEqual([1, 2, 3, 4]);
        expect(requestedOffsets).toEqual([0, 2, 4]); // trailing empty fetch then stop
    });

    it('uses the server actual first-page length, not the requested limit (no under-fetch on server-side cap)', async () => {
        // Regression: caller requested limit=500 but the server caps pages at 2.
        // Trusting the requested limit would read the full first page (2 < 500)
        // as the final page and silently drop pages 2+. The strategy must adopt
        // the actual first-page length (2) as the threshold instead.
        const { fetchPage, requestedOffsets } = bareFetcher([[1, 2], [3, 4], [5]]);
        const items = await collect(
            new PagePromise(fetchPage, bareArrayOffset<number>(), { offset: 0, limit: 500 }),
        );
        expect(items).toEqual([1, 2, 3, 4, 5]);
        expect(requestedOffsets).toEqual([0, 2, 4]);
    });
});

// ── error propagation ─────────────────────────────────────────────────────

describe('iteration error propagation', () => {
    it('throws a non-first-page error out of the for-await; page-1 items already yielded', async () => {
        const boom = new Error('page 2 failed');
        let i = 0;
        const fetchPage = (): Promise<OffsetPage> => {
            i++;
            if (i === 1) return Promise.resolve({ records: [1, 2], total: 10 });
            return Promise.reject(boom);
        };
        const strat = offsetWithTotal<OffsetPage, number>((p) => p.records, (p) => p.total);
        const seen: number[] = [];
        await expect(
            (async (): Promise<void> => {
                for await (const n of new PagePromise(fetchPage, strat, { offset: 0 })) seen.push(n);
            })(),
        ).rejects.toBe(boom);
        expect(seen).toEqual([1, 2]); // page 1 items were delivered before the failure
    });
});
