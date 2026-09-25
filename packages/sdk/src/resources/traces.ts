// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
import type { FetchClient } from '../_internal/fetch-client';
import { PagePromise, cursorBased, type PageParams } from '../_internal/pagination';
import type { Trace, TraceListParams, TraceListResponse, TraceSummary } from '../types/traces';

export interface TraceReplayOptions {
    readonly against_current_spec?: boolean;
}

export interface TraceReplayStage {
    readonly stage: string;
    readonly original: { verdict: string; reason?: string };
    readonly replayed: { verdict: string; reason?: string };
    readonly match: boolean;
    readonly cause?: string;
}

export interface TraceReplayResponse {
    readonly trace_id: string;
    readonly tenant: string;
    readonly proposed_spec_version: string;
    readonly proposed_spec_hash: string;
    readonly stages: ReadonlyArray<TraceReplayStage>;
    readonly deterministic_match: boolean;
    readonly stages_diverged: ReadonlyArray<string>;
    readonly against_current_spec: boolean;
}

/**
 * Trace observability + replay + bundle resource.
 *
 *   client.traces.get(traceId)             → GET  /runtime/traces/{trace_id}
 *   client.traces.list(params?)            → GET  /runtime/traces?...
 *   client.traces.replay(traceId, opts?)   → POST /runtime/traces/{trace_id}/replay
 *   client.traces.bundle(traceId)          → GET  /runtime/traces/{trace_id}/bundle (binary)
 */
export class TracesResource {
    public constructor(private readonly client: FetchClient) {}

    public async get(traceId: string): Promise<Trace> {
        return await this.client.get<Trace>(`/runtime/traces/${encodeURIComponent(traceId)}`, undefined, { operationId: 'getTrace' });
    }

    /**
     * List traces. Returns a {@link PagePromise}: `await` it for the first page
     * (`{ traces, next_cursor }` — unchanged), or `for await (… of …)` to
     * auto-paginate over every trace following `next_cursor` to exhaustion.
     * Pass `{ signal }` to cancel an in-flight page; `break` also stops fetches.
     */
    public list(
        params?: TraceListParams,
        options?: { signal?: AbortSignal },
    ): PagePromise<TraceListResponse, TraceSummary> {
        const buildQuery = (cursor?: string, limit?: number): Record<string, string | number | boolean | undefined> => {
            const query: Record<string, string | number | boolean | undefined> = {};
            if (params?.flow !== undefined) query.flow = params.flow;
            if (params?.user !== undefined) query.user = params.user;
            if (params?.from !== undefined) query.from = params.from;
            if (params?.to !== undefined) query.to = params.to;
            if (params?.outcome !== undefined) query.outcome = params.outcome;
            if (limit !== undefined) query.limit = limit;
            if (cursor !== undefined) query.cursor = cursor;
            return query;
        };

        const signal = options?.signal;
        const fetchPage = (p: PageParams): Promise<TraceListResponse> => {
            const query = buildQuery(p.cursor, p.limit);
            return this.client.get<TraceListResponse>('/runtime/traces', query, { operationId: 'queryTraces', ...(signal ? { signal } : {}) });
        };

        return new PagePromise(
            fetchPage,
            cursorBased<TraceListResponse, TraceSummary>((page) => page.traces, (page) => page.next_cursor),
            {
                ...(params?.limit !== undefined ? { limit: params.limit } : {}),
                ...(params?.cursor !== undefined ? { cursor: params.cursor } : {}),
            },
        );
    }

    public async replay(traceId: string, opts?: TraceReplayOptions): Promise<TraceReplayResponse> {
        const body: Record<string, unknown> = {};
        if (opts?.against_current_spec !== undefined) body.against_current_spec = opts.against_current_spec;
        return await this.client.post<TraceReplayResponse>(
            `/runtime/traces/${encodeURIComponent(traceId)}/replay`,
            body,
            { operationId: 'replayTrace' },
        );
    }

    /**
     * Download an evidence bundle as a `.tar.gz` ArrayBuffer. The caller is
     * responsible for writing the bytes to disk; CLI consumers pipe via
     * `--output <path>`.
     */
    public async bundle(traceId: string): Promise<ArrayBuffer> {
        return await this.client.getBinary(
            `/runtime/traces/${encodeURIComponent(traceId)}/bundle`,
            undefined,
            { operationId: 'getTraceBundle' },
        );
    }
}
