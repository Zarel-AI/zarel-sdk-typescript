// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
import type { FetchClient } from '../_internal/fetch-client';
import { PagePromise, cursorBased, type PageParams } from '../_internal/pagination';
import type { Receipt, ReceiptListParams, ReceiptListResponse } from '../types/receipt';

/**
 * End-user verifiable receipts resource.
 *
 *   client.runtime.receipts.list()                    → GET /runtime/receipts
 *   client.runtime.receipts.list({ signal: 'refusal' })
 *   client.runtime.receipts.list({ trace_id })
 *
 * Returns a {@link PagePromise}: `await` it for the first page
 * (`{ items, next_cursor }`), or `for await (… of …)` to auto-paginate over
 * every receipt to exhaustion. Each `Receipt` is the CALLER'S OWN governance
 * event (scoped server-side to the token actor — no `view_traces`), carrying
 * only a non-reversible proof (hash + masked value), never the raw value.
 * Mirrors `client.runtime.audit.list` (the operator, tenant-wide surface).
 */
export class ReceiptsResource {
    public constructor(private readonly client: FetchClient) {}

    public list(
        params?: ReceiptListParams,
        options?: { signal?: AbortSignal },
    ): PagePromise<ReceiptListResponse, Receipt> {
        const path = '/runtime/receipts';
        const buildQuery = (cursor?: string, limit?: number): Record<string, string | number | boolean | undefined> => {
            const query: Record<string, string | number | boolean | undefined> = {};
            if (params?.signal !== undefined) query.signal = params.signal;
            if (params?.trace_id !== undefined) query.trace_id = params.trace_id;
            if (params?.from !== undefined) query.from = params.from;
            if (params?.to !== undefined) query.to = params.to;
            if (limit !== undefined) query.limit = limit;
            if (cursor !== undefined) query.cursor = cursor;
            return query;
        };

        const signal = options?.signal;
        const fetchPage = (p: PageParams): Promise<ReceiptListResponse> =>
            this.client.get<ReceiptListResponse>(path, buildQuery(p.cursor, p.limit), {
                operationId: 'listReceipts',
                ...(signal ? { signal } : {}),
            });

        return new PagePromise(
            fetchPage,
            cursorBased<ReceiptListResponse, Receipt>((page) => page.items, (page) => page.next_cursor),
            {
                ...(params?.limit !== undefined ? { limit: params.limit } : {}),
                ...(params?.cursor !== undefined ? { cursor: params.cursor } : {}),
            },
        );
    }
}
