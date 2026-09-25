// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
/**
 * Trace observability types.
 *
 * Wire shapes of the runtime API's trace responses, kept as plain interfaces
 * with no dependencies.
 */

/**
 * WHICH WINDOW a trace's timing fields were measured over.
 *
 * The listing and the single-trace read answer different questions about the same trace: a
 * conversation answered in 6 s whose webhook retry settled at 40 s reports 6 s in the list and
 * 40 s when opened. Both are true, so each surface declares its own basis.
 */
export type TraceDurationBasis = 'anchor_evidence' | 'all_evidence';

export type TraceOutcome = 'executed' | 'refused' | 'awaiting_human_decision' | 'failed';

export type TraceStage =
    | 'topic_gate'
    | 'intent_scoring'
    | 'envelope'
    | 'gatekeeper'
    | 'preconditions'
    | 'hitl'
    | 'execution'
    | 'audit';

export interface TraceEventError {
    readonly code: string;
    readonly message: string;
}

export interface TraceEvent {
    readonly type: string;
    readonly timestamp: string;
    readonly stage: TraceStage;
    readonly data: Record<string, unknown>;
    readonly error?: TraceEventError | null;
}

export interface TraceUserRef {
    readonly user_name: string;
    readonly roles: ReadonlyArray<string>;
}

export interface Trace {
    readonly trace_id: string;
    readonly tenant: string;
    readonly session_key: string | null;
    readonly parent_trace_id: string | null;
    readonly spec_version: string;
    readonly spec_hash: string;
    readonly user: TraceUserRef | null;
    readonly flow: string | null;
    readonly started_at: string;
    readonly completed_at: string | null;
    readonly duration_ms: number | null;
    /** Always `all_evidence`: this view lists every event, so its window covers them. */
    readonly duration_basis: TraceDurationBasis;
    readonly outcome: TraceOutcome;
    readonly events: ReadonlyArray<TraceEvent>;
}

export interface TraceSummary {
    readonly trace_id: string;
    readonly started_at: string;
    readonly completed_at: string | null;
    readonly flow: string | null;
    readonly user_name: string | null;
    readonly duration_ms: number | null;
    /** Always `anchor_evidence`: the anchoring evidence's span, so one late delivery
     *  cannot make a fast conversation look slow in a scanned page. */
    readonly duration_basis: TraceDurationBasis;
    readonly outcome: TraceOutcome;
}

export interface TraceListParams {
    readonly flow?: string;
    readonly user?: string;
    readonly from?: string;
    readonly to?: string;
    readonly outcome?: TraceOutcome;
    readonly limit?: number;
    readonly cursor?: string;
}

export interface TraceListResponse {
    readonly traces: ReadonlyArray<TraceSummary>;
    readonly next_cursor: string | null;
}
