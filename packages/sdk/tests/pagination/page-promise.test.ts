// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// PagePromise Promise-face + laziness/memoization.
import { PagePromise, type PaginationStrategy, type PageParams } from '../../src/_internal/pagination';

interface FakePage {
    items: number[];
    cursor: string | null;
}

// A simple cursor strategy over FakePage for these tests.
function fakeStrategy(): PaginationStrategy<FakePage, number> {
    return {
        items: (page) => page.items,
        nextParams: (page, current) => (page.cursor === null ? null : { ...current, cursor: page.cursor }),
    };
}

function makeFetcher(pages: FakePage[]): {
    fetchPage: (params: PageParams) => Promise<FakePage>;
    calls: () => number;
} {
    let index = 0;
    let calls = 0;
    return {
        fetchPage: (): Promise<FakePage> => {
            calls++;
            const page = pages[index] ?? { items: [], cursor: null };
            index++;
            return Promise.resolve(page);
        },
        calls: (): number => calls,
    };
}

describe('PagePromise — Promise face', () => {
    it('await resolves to the first page', async () => {
        const { fetchPage } = makeFetcher([{ items: [1, 2], cursor: null }]);
        const pp = new PagePromise(fetchPage, fakeStrategy(), {});
        const page = await pp;
        expect(page).toEqual({ items: [1, 2], cursor: null });
    });

    it('.then delegates to the first-page promise', async () => {
        const { fetchPage } = makeFetcher([{ items: [7], cursor: null }]);
        const pp = new PagePromise(fetchPage, fakeStrategy(), {});
        const mapped = await pp.then((page) => page.items.length);
        expect(mapped).toBe(1);
    });

    it('.catch surfaces a first-page rejection', async () => {
        const boom = new Error('boom');
        const pp = new PagePromise<FakePage, number>(() => Promise.reject(boom), fakeStrategy(), {});
        await expect(pp).rejects.toBe(boom);
        await expect(pp.catch((e) => e)).resolves.toBe(boom);
    });

    it('.finally runs and passes the value through', async () => {
        const { fetchPage } = makeFetcher([{ items: [1], cursor: null }]);
        const pp = new PagePromise(fetchPage, fakeStrategy(), {});
        let ran = false;
        const page = await pp.finally(() => {
            ran = true;
        });
        expect(ran).toBe(true);
        expect(page.items).toEqual([1]);
    });

    it('reports the PagePromise toStringTag', () => {
        const { fetchPage } = makeFetcher([{ items: [], cursor: null }]);
        const pp = new PagePromise(fetchPage, fakeStrategy(), {});
        expect(Object.prototype.toString.call(pp)).toBe('[object PagePromise]');
    });

    it('is lazy — fetches nothing until awaited or iterated', async () => {
        const { fetchPage, calls } = makeFetcher([{ items: [1], cursor: null }]);
        const pp = new PagePromise(fetchPage, fakeStrategy(), {});
        expect(calls()).toBe(0);
        await pp;
        expect(calls()).toBe(1);
    });

    it('fetches the first page only once when both awaited and iterated', async () => {
        const { fetchPage, calls } = makeFetcher([{ items: [1, 2], cursor: null }]);
        const pp = new PagePromise(fetchPage, fakeStrategy(), {});
        await pp; // fetch page 1
        const seen: number[] = [];
        for await (const n of pp) seen.push(n); // reuse memoized page 1
        expect(seen).toEqual([1, 2]);
        expect(calls()).toBe(1);
    });
});
