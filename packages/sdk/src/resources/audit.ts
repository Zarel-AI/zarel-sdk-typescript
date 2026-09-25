// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
import type { FetchClient } from '../_internal/fetch-client';
import { PagePromise, cursorBased, type PageParams } from '../_internal/pagination';
import type {
    AuditRowLogName,
    BindingViolationAuditRow,
    TopicRefusalAuditRow,
    BindingViolationAuditListParams,
    TopicRefusalAuditListParams,
    AuditListResponse,
} from '../types/audit';

/** The event logs that carry an audit hash-chain. */
export type AuditLogName = 'state_machine' | 'flows';

type AnyAuditRow = BindingViolationAuditRow | TopicRefusalAuditRow;
type AnyAuditListParams = BindingViolationAuditListParams & TopicRefusalAuditListParams;

/**
 * Optional inclusive `seq` range to bound the exported chain. Use it to
 * narrow a large log — a request whose selected range
 * exceeds the server's per-bundle event cap is refused with HTTP 413.
 */
export interface AuditEvidenceRange {
    readonly from?: number;
    readonly to?: number;
}

/**
 * Audit tamper-evidence resource.
 *
 *   client.audit.evidence(log)          → GET /runtime/audit/{log}/evidence
 *   client.audit.evidence(log, {from,to}) → …?from=&to= (bounded slice)
 *
 * Downloads a signed evidence bundle (the event hash-chain + covering signed
 * checkpoints + any external RFC 3161 TSA anchors over them + a signed
 * manifest) for offline verification with `zarel verify`. Mirrors
 * `traces.bundle()` — the body is a binary `application/gzip` stream, so it
 * returns a generic `ArrayBuffer` the caller writes to disk. The anchors ride
 * INSIDE the bundle: no SDK-call change — verify them offline with `--tsa-roots`.
 */
export class AuditResource {
    public constructor(private readonly client: FetchClient) {}

    /**
     * List rows of a privacy-preserving audit row-table:
     *
     *   client.runtime.audit.list('binding_violations', { entity })  → GET /runtime/audit/binding_violations?…
     *   client.runtime.audit.list('topic_refusals', { category })    → GET /runtime/audit/topic_refusals?…
     *
     * Returns a {@link PagePromise}: `await` it for the first page
     * (`{ items, next_cursor }`), or `for await (… of …)` to auto-paginate over
     * every row following `next_cursor` to exhaustion. Rows carry only the
     * SHA-256 hash + PII-masked value — never the raw offending value. Gated by
     * the `view_traces` runtime-system action; an unauthorized actor or an
     * unknown log gets an opaque 404.
     */
    public list(
        log: 'binding_violations',
        params?: BindingViolationAuditListParams,
        options?: { signal?: AbortSignal },
    ): PagePromise<AuditListResponse<BindingViolationAuditRow>, BindingViolationAuditRow>;
    public list(
        log: 'topic_refusals',
        params?: TopicRefusalAuditListParams,
        options?: { signal?: AbortSignal },
    ): PagePromise<AuditListResponse<TopicRefusalAuditRow>, TopicRefusalAuditRow>;
    public list(
        log: AuditRowLogName,
        params?: AnyAuditListParams,
        options?: { signal?: AbortSignal },
    ): PagePromise<AuditListResponse<AnyAuditRow>, AnyAuditRow> {
        const path = `/runtime/audit/${encodeURIComponent(log)}`;
        const buildQuery = (cursor?: string, limit?: number): Record<string, string | number | boolean | undefined> => {
            const query: Record<string, string | number | boolean | undefined> = {};
            if (params?.from !== undefined) query.from = params.from;
            if (params?.to !== undefined) query.to = params.to;
            if (params?.entity !== undefined) query.entity = params.entity;
            if (params?.field !== undefined) query.field = params.field;
            if (params?.bindingMode !== undefined) query.binding_mode = params.bindingMode;
            if (params?.category !== undefined) query.category = params.category;
            if (params?.reason !== undefined) query.reason = params.reason;
            if (params?.verdict !== undefined) query.verdict = params.verdict;
            if (limit !== undefined) query.limit = limit;
            if (cursor !== undefined) query.cursor = cursor;
            return query;
        };

        const signal = options?.signal;
        const fetchPage = (p: PageParams): Promise<AuditListResponse<AnyAuditRow>> =>
            this.client.get<AuditListResponse<AnyAuditRow>>(path, buildQuery(p.cursor, p.limit), {
                operationId: 'listAuditLog',
                ...(signal ? { signal } : {}),
            });

        return new PagePromise(
            fetchPage,
            cursorBased<AuditListResponse<AnyAuditRow>, AnyAuditRow>((page) => page.items, (page) => page.next_cursor),
            {
                ...(params?.limit !== undefined ? { limit: params.limit } : {}),
                ...(params?.cursor !== undefined ? { cursor: params.cursor } : {}),
            },
        );
    }

    public async evidence(log: AuditLogName, range?: AuditEvidenceRange): Promise<ArrayBuffer> {
        return await this.client.getBinary(
            `/runtime/audit/${encodeURIComponent(log)}/evidence`,
            { from: range?.from, to: range?.to },
            { operationId: 'getAuditEvidenceBundle' },
        );
    }
}
