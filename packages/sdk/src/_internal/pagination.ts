// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
/**
 * Auto-pagination. Pure TS, zero runtime deps.
 *
 * `PagePromise<Page, Item>` is the value returned by the SDK's paginated `list`
 * calls. It is simultaneously:
 *   - a `Promise<Page>` — `await list(...)` resolves to today's single-page shape
 *     (backward-compatible: the class implements the full `Promise<Page>`
 *     interface, so it stays assignable to the single-page return type); and
 *   - an `AsyncIterable<Item>` — `for await (const item of list(...))` paginates
 *     over every item across all pages.
 *
 * A `PaginationStrategy` knows how to extract items from a page and how to
 * advance to the next page (or signal exhaustion) for one of the three wire
 * models (offset+total, cursor, bare-array-offset). Strategies use typed
 * accessor functions — never `as` or a schema library.
 *
 * No default page size is injected into the request: the first page is fetched
 * with the caller's params verbatim (so `await list(...)` sends exactly the
 * request a single-page call would). Page size, where a strategy needs it, is the caller's
 * `limit` or the size of the first page returned by the server.
 */

/** Per-page request parameters the iterator advances between pages. */
export interface PageParams {
    limit?: number;
    offset?: number;
    cursor?: string;
    [key: string]: unknown;
}

/** How to read items from a page and compute the next page's params. */
export interface PaginationStrategy<Page, Item> {
    items(page: Page): readonly Item[];
    /** Next page's params, or `null` when the result set is exhausted. */
    nextParams(page: Page, current: PageParams, lastCount: number): PageParams | null;
}

/**
 * Offset pagination with an authoritative `total` (e.g. records). Advances the
 * offset by the number of items actually returned and stops once `total` is
 * consumed — robust to a server page size that differs from any caller `limit`.
 */
export function offsetWithTotal<Page, Item>(
    getItems: (page: Page) => readonly Item[],
    getTotal: (page: Page) => number,
): PaginationStrategy<Page, Item> {
    return {
        items: getItems,
        nextParams(page, current, lastCount): PageParams | null {
            const total = getTotal(page);
            const consumed = (current.offset ?? 0) + lastCount;
            if (lastCount === 0 || consumed >= total) return null;
            return { ...current, offset: consumed };
        },
    };
}

/** Cursor pagination (e.g. traces). Follows the next cursor until it is null/absent. */
export function cursorBased<Page, Item>(
    getItems: (page: Page) => readonly Item[],
    getCursor: (page: Page) => string | null | undefined,
): PaginationStrategy<Page, Item> {
    return {
        items: getItems,
        nextParams(page, current): PageParams | null {
            const cursor = getCursor(page);
            // Deliberate loose `==` — treats both null and undefined as terminal.
            if (cursor == null) return null;
            return { ...current, cursor };
        },
    };
}

/**
 * Offset pagination over a bare array with no `total`/cursor (e.g. conversation
 * sessions). End-of-data is inferred from `lastCount < pageSize`, where the
 * page size is the **server's actual first-page length** — never the caller's
 * requested `limit`. Trusting the requested `limit` would silently drop data if
 * the server capped a page below it (a full first page shorter than the
 * requested `limit` would be misread as the final page). Consequences: (a) one
 * extra request returns an empty page and iteration stops when the row count is
 * an exact multiple of the page size; (b) one extra empty request when the
 * whole result fits within the first page — both bounded, no item missed or
 * duplicated. The requested `limit` is still sent as the per-request page size
 * by the resource; this strategy governs only termination.
 */
export function bareArrayOffset<Item>(): PaginationStrategy<Item[], Item> {
    let pageSize: number | undefined;
    return {
        items: (page) => page,
        nextParams(_page, current, lastCount): PageParams | null {
            if (pageSize === undefined) pageSize = lastCount;
            if (pageSize === 0 || lastCount < pageSize) return null;
            return { ...current, offset: (current.offset ?? 0) + lastCount };
        },
    };
}

/** A promise of the first page that can also be async-iterated over all items. */
export class PagePromise<Page, Item> implements Promise<Page>, AsyncIterable<Item> {
    private firstPage?: Promise<Page>;

    public constructor(
        private readonly fetchPage: (params: PageParams) => Promise<Page>,
        private readonly strategy: PaginationStrategy<Page, Item>,
        private readonly initialParams: PageParams,
    ) {}

    private getFirstPage(): Promise<Page> {
        if (!this.firstPage) this.firstPage = this.fetchPage(this.initialParams);
        return this.firstPage;
    }

    // ── Promise<Page> face (delegates to the lazy, memoized first page) ──

    public then<TResult1 = Page, TResult2 = never>(
        onfulfilled?: ((value: Page) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ): Promise<TResult1 | TResult2> {
        return this.getFirstPage().then(onfulfilled, onrejected);
    }

    public catch<TResult = never>(
        onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null,
    ): Promise<Page | TResult> {
        return this.getFirstPage().catch(onrejected);
    }

    public finally(onfinally?: (() => void) | null): Promise<Page> {
        return this.getFirstPage().finally(onfinally);
    }

    public get [Symbol.toStringTag](): string {
        return 'PagePromise';
    }

    // ── AsyncIterable<Item> face ──

    public async *[Symbol.asyncIterator](): AsyncIterator<Item> {
        let params = this.initialParams;
        let page = await this.getFirstPage(); // reuse the memoized first page
        for (;;) {
            const items = this.strategy.items(page);
            for (const item of items) yield item;
            const next = this.strategy.nextParams(page, params, items.length);
            if (next === null) return;
            params = next;
            page = await this.fetchPage(next);
        }
    }
}
