// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
/**
 * Audit log read-surface types.
 *
 * Wire shapes of the runtime API's audit-log list responses, kept as plain
 * interfaces with no dependencies (same convention as `types/traces.ts`).
 *
 * Distinct from `AuditLogName` (`state_machine | flows`) in `resources/audit.ts`,
 * which names the evidence hash-chains, not these listable logs.
 */

/** The two privacy-preserving audit logs whose entries can be listed. */
export type AuditRowLogName = 'binding_violations' | 'topic_refusals';

export interface BindingViolationAuditRow {
    readonly id: string;
    readonly entity: string;
    readonly field: string;
    readonly binding_mode: 'bind' | 'assert' | 'immutable';
    readonly reason: string;
    readonly input_sha256: string;
    readonly input_masked: string;
    readonly path_context: string | null;
    readonly trace_id: string;
    readonly created_by: string;
    readonly created_at: string;
}

export interface TopicRefusalAuditRow {
    readonly id: string;
    readonly channel_name: string | null;
    readonly verdict: string;
    readonly category: string;
    readonly reason: 'matched' | 'no_verdict' | 'unscored';
    readonly confidence: number | null;
    readonly strategy: string | null;
    readonly fallback_used: boolean;
    readonly contract_version: number;
    readonly input_sha256: string;
    readonly input_masked: string;
    readonly latency_ms: number | null;
    readonly trace_id: string;
    readonly created_by: string;
    readonly created_at: string;
}

/** Shared filters (both logs). `from`/`to` are inclusive ISO date-time bounds. */
export interface AuditListParamsBase {
    readonly from?: string;
    readonly to?: string;
    readonly limit?: number;
    readonly cursor?: string;
}

export interface BindingViolationAuditListParams extends AuditListParamsBase {
    readonly entity?: string;
    readonly field?: string;
    readonly bindingMode?: 'bind' | 'assert' | 'immutable';
}

export interface TopicRefusalAuditListParams extends AuditListParamsBase {
    readonly category?: string;
    readonly reason?: 'matched' | 'no_verdict' | 'unscored';
    readonly verdict?: string;
}

export interface AuditListResponse<Row> {
    readonly items: ReadonlyArray<Row>;
    readonly next_cursor: string | null;
}
