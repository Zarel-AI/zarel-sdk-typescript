// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
/**
 * Spec-document types.
 *
 * Wire shapes of the contract API's spec-diff responses, kept as plain
 * interfaces with no dependencies.
 */

export type SpecSection =
    | 'entities'
    | 'flows'
    | 'roles'
    | 'authorization'
    | 'mcp_servers'
    | 'llm_services'
    | 'policies';

export type ChangeKind = 'added' | 'removed' | 'modified';

export type ImpactClass = 'breaking' | 'behavioural' | 'additive';

export type ReviewerRole = 'compliance' | 'ops-leadership' | 'engineering';

export interface SpecHashes {
    readonly version: string;
    readonly hash: string;
}

export interface SpecChange {
    readonly path: string;
    readonly section: SpecSection;
    readonly kind: ChangeKind;
    readonly before: Record<string, unknown> | null;
    readonly after: Record<string, unknown> | null;
    readonly impact_class: ImpactClass;
    readonly human_summary: string;
}

export interface ImpactSummary {
    readonly flows_affected: ReadonlyArray<string>;
    readonly roles_affected: ReadonlyArray<string>;
    readonly has_breaking_changes: boolean;
    readonly may_reject_previously_allowed: boolean;
    readonly may_require_hitl_previously_not: boolean;
    readonly recommended_reviewers: ReadonlyArray<ReviewerRole>;
}

export interface SpecDiff {
    readonly tenant: string;
    readonly current: SpecHashes;
    readonly proposed: SpecHashes;
    readonly changes: ReadonlyArray<SpecChange>;
    readonly impact_summary: ImpactSummary;
}

// ============================================================================
// Wire shapes for the route bodies + responses
// ============================================================================

export type SpecApplyMode = 'upsert' | 'replace';

/**
 * Two-plane contract files. `structural` carries the
 * structural YAML (entities, fields, roles, policies, transitions, guards,
 * flows — names/types/policies only). `semanticByLocale` carries the
 * per-locale `.i18n.<locale>.yaml` content as a record keyed by locale code
 * (e.g. `{ en: '...', es: '...' }`). The canonical locale (`en`) must
 * validate atomically; other locales fail soft with warnings.
 *
 * A single-plane `{yaml: string}` body is not accepted. Send un-split YAML
 * as `files: { structural: yaml }` with no semantic siblings.
 */
export interface SpecFiles {
    readonly structural: string;
    readonly semanticByLocale?: Readonly<Record<string, string>>;
}

export interface SpecPublishRequest {
    readonly files: SpecFiles;
    readonly mode: SpecApplyMode;
    readonly expected_hash?: string;
    /**
     * Explicit consent to proceed when plan-as-ceiling
     * enforcement would strip more than the server threshold (10) of
     * over-budget grants; without it such a publish fails 422
     * `strip_threshold_exceeded`.
     */
    readonly force?: boolean;
}

/** A grant removed by plan-as-ceiling enforcement. */
export interface StrippedGrant {
    readonly role: string;
    readonly kind: 'section' | 'system';
    readonly target: string | null;
    readonly action: string;
    readonly reason: 'envelope_exceeded' | 'owner_role_protected';
}

export interface SpecPublishResponse {
    readonly tenant_name: string;
    readonly applied_mode: SpecApplyMode;
    readonly summary: {
        readonly entities: number;
        readonly roles: number;
        readonly skills: number;
        readonly actions: number;
    };
    /** Grants stripped by this publish ([] when none). */
    readonly stripped_grants: ReadonlyArray<StrippedGrant>;
}

export interface SpecDiffRequest {
    readonly proposed_spec: string;
}

export interface SpecApplyGating {
    readonly reject_breaking_changes?: boolean;
    readonly max_changes?: number;
}

export interface SpecApplyRequest {
    readonly files: SpecFiles;
    readonly mode: SpecApplyMode;
    readonly expected_hash?: string;
    readonly gating?: SpecApplyGating;
    /**
     * Same semantics as `SpecPublishRequest.force`:
     * required to proceed when plan-as-ceiling enforcement would strip more
     * than the server threshold (10) of over-budget grants (422
     * `strip_threshold_exceeded` otherwise).
     */
    readonly force?: boolean;
}

export interface SpecApplyResponse {
    readonly applied: true;
    readonly diff: SpecDiff;
    /** Grants stripped by this apply ([] when none). */
    readonly stripped_grants: ReadonlyArray<StrippedGrant>;
}

export interface SpecSnapshotV1Response {
    readonly tenant_name: string;
    readonly spec_version: string;
    readonly contract_version: number;
    readonly hash: string;
    readonly contract: unknown;
}

// ============================================================================
// Dry-run wire types.
// ============================================================================

export type SpecDryRunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export type SpecDryRunOutcome = 'executed' | 'refused' | 'awaiting_human_decision' | 'failed';
export type SpecDryRunUnknownCause = 'intent_classification_unreusable' | 'external_tool_result_uncached' | 'reference_to_removed_feature';

export interface SpecDryRunReplayWindow {
    readonly from: string; // ISO-8601
    readonly to: string;
}

export interface SpecDryRunFilter {
    readonly flow?: string;
    readonly user?: string;
}

export interface SpecDryRunSubmitRequest {
    readonly proposed_spec: string;
    readonly replay_window: SpecDryRunReplayWindow;
    readonly filter?: SpecDryRunFilter;
}

export interface SpecDryRunSubmitResponse {
    readonly report_id: string;
    readonly status: 'queued' | 'running';
}

export interface SpecDryRunChangeBreakdown {
    readonly from_outcome: SpecDryRunOutcome;
    readonly to_outcome: SpecDryRunOutcome;
    readonly count: number;
    readonly cause: string;
    readonly example_trace_ids: ReadonlyArray<string>;
}

export interface SpecDryRunUnknown {
    readonly cause: SpecDryRunUnknownCause;
    readonly count: number;
    readonly example_trace_ids: ReadonlyArray<string>;
}

export interface SpecDryRunAffectedUser {
    readonly user_name: string;
    readonly sessions_affected: number;
}

export interface SpecDryRunOperationalImplications {
    readonly estimated_additional_hitl_per_month: number;
    readonly required_roles: ReadonlyArray<string>;
}

export interface SpecDryRunReport {
    readonly tenant: string;
    readonly spec_diff: SpecDiff;
    readonly replay_window: SpecDryRunReplayWindow;
    readonly sessions_evaluated: number;
    readonly outcomes_unchanged: number;
    readonly outcomes_changed: number;
    readonly change_breakdown: ReadonlyArray<SpecDryRunChangeBreakdown>;
    readonly affected_users: ReadonlyArray<SpecDryRunAffectedUser>;
    readonly unknowns: ReadonlyArray<SpecDryRunUnknown>;
    readonly operational_implications: SpecDryRunOperationalImplications;
    readonly generated_at: string;
}

export interface SpecDryRunJobProgress {
    readonly traces_processed: number;
    readonly traces_total: number | null;
}

export interface SpecDryRunJobFailure {
    readonly code: string;
    readonly message: string;
}

export interface SpecDryRunJob {
    readonly tenant: string;
    readonly report_id: string;
    readonly status: SpecDryRunStatus;
    readonly progress: SpecDryRunJobProgress | null;
    readonly result: SpecDryRunReport | null;
    readonly failure: SpecDryRunJobFailure | null;
    readonly started_at: string;
    readonly completed_at: string | null;
}
