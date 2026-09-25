// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// Pagination is lazy + cancellable.
import { Zarel } from '../../src/client';
import { PagePromise, offsetWithTotal, type PageParams } from '../../src/_internal/pagination';
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

interface OffsetPage {
    records: RecordData[];
    total: number;
}

describe('pagination — lazy + cancellable', () => {
    afterEach(() => jest.restoreAllMocks());

    it('fetches nothing until awaited or iterated', () => {
        let calls = 0;
        const fetchPage = (): Promise<OffsetPage> => {
            calls++;
            return Promise.resolve({ records: [{ id: 1 }], total: 1 });
        };
        // Construct but neither await nor iterate.
        void new PagePromise(fetchPage, offsetWithTotal<OffsetPage, RecordData>((p) => p.records, (p) => p.total), {});
        expect(calls).toBe(0);
    });

    it('break after page 1 issues no further page request', async () => {
        let calls = 0;
        const fetchPage = (p: PageParams): Promise<OffsetPage> => {
            calls++;
            const offset = p.offset ?? 0;
            return Promise.resolve({ records: [{ id: offset + 1 }, { id: offset + 2 }], total: 100 });
        };
        const pp = new PagePromise(fetchPage, offsetWithTotal<OffsetPage, RecordData>((p) => p.records, (p) => p.total), { offset: 0 });
        const seen: unknown[] = [];
        for await (const rec of pp) {
            seen.push(rec.id);
            break; // stop after the very first item
        }
        expect(seen).toEqual([1]);
        expect(calls).toBe(1); // only page 1 was fetched
    });

    it('an already-aborted signal rejects iteration before any data', async () => {
        const fetchFn: MockFetch = jest.fn<Promise<Response>, [input: string | URL | Request, init?: RequestInit]>(() =>
            Promise.resolve(jsonResponse({ records: [{ id: 1 }], total: 100 })),
        );
        const zarel = makeZarel(fetchFn);
        const ac = new AbortController();
        ac.abort();
        await expect(
            (async (): Promise<void> => {
                for await (const rec of zarel.runtime.records.list('orders', { limit: 2 }, { signal: ac.signal })) {
                    void rec; // unreachable — the aborted signal rejects the first fetch
                }
            })(),
        ).rejects.toThrow();
    });

    it('aborting mid-iteration stops before the next page', async () => {
        const fetchFn: MockFetch = jest.fn((input) => {
            const offset = Number(new URL(input as string).searchParams.get('offset') ?? '0');
            return Promise.resolve(jsonResponse({ records: [{ id: offset + 1 }, { id: offset + 2 }], total: 100 }));
        });
        const zarel = makeZarel(fetchFn);
        const ac = new AbortController();
        const seen: unknown[] = [];
        await expect(
            (async (): Promise<void> => {
                for await (const rec of zarel.runtime.records.list('orders', { limit: 2 }, { signal: ac.signal })) {
                    seen.push(rec.id);
                    if (seen.length === 2) ac.abort(); // abort after page 1 fully consumed
                }
            })(),
        ).rejects.toThrow();
        expect(seen).toEqual([1, 2]); // page 1 delivered; page 2 fetch aborted
    });
});
