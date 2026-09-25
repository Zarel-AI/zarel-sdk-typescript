// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
import { type FetchClient, localeQuery } from '../_internal/fetch-client';
import { confirmationHeaders } from '../_internal/confirmation';
import { PagePromise, offsetWithTotal, type PageParams } from '../_internal/pagination';
import type { ConfirmationRetryOptions } from '../types/confirmation';
import type { BulkImportRequest, BulkImportResponse } from '../types/imports';
import type {
    RecordData,
    RecordListParams,
    RecordListResponse,
    RecordResponse,
} from '../types/records';
import type { LocaleOptions } from '../types/locale';

/** Options for paginated list calls — locale plus an optional cancellation signal. */
type ListOptions = LocaleOptions & { signal?: AbortSignal };

export class RecordsResource {
    constructor(private readonly client: FetchClient) {}

    /**
     * List and filter records for a given entity.
     *
     * Returns a {@link PagePromise}: `await` it for the first page
     * (`{ records, total }` — unchanged), or `for await (… of …)` to
     * auto-paginate over every record across all pages. Pass `{ signal }` to
     * cancel an in-flight page; `break` also stops further fetches.
     */
    list(
        entityName: string,
        params?: RecordListParams,
        options?: ListOptions,
    ): PagePromise<RecordListResponse, RecordData> {
        const buildQuery = (offset?: number, limit?: number): Record<string, string | number | boolean | undefined> => {
            const query: Record<string, string | number | boolean | undefined> = {};
            if (limit !== undefined) query.limit = limit;
            if (offset !== undefined) query.offset = offset;

            if (params?.filters) {
                for (const [key, value] of Object.entries(params.filters)) {
                    if (value === null || value === undefined) continue;
                    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                        query[`filters[${key}]`] = value;
                    } else {
                        query[`filters[${key}]`] = JSON.stringify(value);
                    }
                }
            }

            if (params?.sort && params.sort.length > 0) {
                query.sort = JSON.stringify(params.sort);
            }

            if (options?.locale) query.locale = options.locale;
            return query;
        };

        const signal = options?.signal;
        const fetchPage = (p: PageParams): Promise<RecordListResponse> => {
            const query = buildQuery(p.offset, p.limit);
            return this.client.get<RecordListResponse>(`/runtime/records/${entityName}`, query, { operationId: 'listRuntimeRecords', ...(signal ? { signal } : {}) });
        };

        return new PagePromise(
            fetchPage,
            offsetWithTotal<RecordListResponse, RecordData>((page) => page.records, (page) => page.total),
            {
                ...(params?.limit !== undefined ? { limit: params.limit } : {}),
                ...(params?.offset !== undefined ? { offset: params.offset } : {}),
            },
        );
    }

    /**
     * Get a single record by ID.
     */
    async get(
        entityName: string,
        recordId: string | number,
        options?: LocaleOptions,
    ): Promise<RecordResponse> {
        return await this.client.get<RecordResponse>(
            `/runtime/records/${entityName}/${recordId}`,
            localeQuery(options),
            { operationId: 'getRuntimeRecord' },
        );
    }

    /**
     * Create a new record for the specified entity.
     *
     * A `confirm` guard can pause this write: the thrown `ZarelAPIError` carries
     * `.confirmation`. Show every `guards[].prompt`, then call
     * again with the IDENTICAL `data` plus `{ confirmationToken }`.
     */
    async create(
        entityName: string,
        data: Record<string, unknown>,
        options?: ConfirmationRetryOptions,
    ): Promise<RecordResponse> {
        return await this.client.post<RecordResponse>(`/runtime/records/${entityName}`, data, {
            operationId: 'createRuntimeRecord',
            headers: confirmationHeaders(options?.confirmationToken),
        });
    }

    /**
     * Create multiple records for the specified entity in a single request.
     */
    async bulk(entityName: string, request: BulkImportRequest): Promise<BulkImportResponse> {
        return await this.client.post<BulkImportResponse>(`/runtime/records/${entityName}/bulk`, request, { operationId: 'bulkImportRuntimeRecords' });
    }

    /**
     * Update an existing record. See {@link create} for the confirmation
     * round-trip `options.confirmationToken` completes.
     */
    async update(
        entityName: string,
        recordId: string | number,
        data: Partial<RecordData>,
        options?: ConfirmationRetryOptions,
    ): Promise<RecordResponse> {
        return await this.client.patch<RecordResponse>(`/runtime/records/${entityName}/${recordId}`, data, {
            operationId: 'patchRuntimeRecord',
            headers: confirmationHeaders(options?.confirmationToken),
        });
    }

    /**
     * Delete a record. See {@link create} for the confirmation round-trip
     * `options.confirmationToken` completes.
     */
    async delete(
        entityName: string,
        recordId: string | number,
        options?: ConfirmationRetryOptions,
    ): Promise<void> {
        await this.client.del(`/runtime/records/${entityName}/${recordId}`, {
            operationId: 'deleteRuntimeRecord',
            headers: confirmationHeaders(options?.confirmationToken),
        });
    }
}
