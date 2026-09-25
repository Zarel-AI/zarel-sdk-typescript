// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
/**
 * Spec-document types. Re-exports from contracts.ts, which holds the
 * definitions.
 */
export type {
    SpecSection,
    ChangeKind,
    ImpactClass,
    ReviewerRole,
    SpecHashes,
    SpecChange,
    ImpactSummary,
    SpecDiff,
    SpecApplyMode,
    SpecFiles,
    SpecPublishRequest,
    SpecPublishResponse,
    SpecDiffRequest,
    SpecApplyGating,
    SpecApplyRequest,
    SpecApplyResponse,
    SpecSnapshotV1Response,
    SpecDryRunStatus,
    SpecDryRunOutcome,
    SpecDryRunUnknownCause,
    SpecDryRunReplayWindow,
    SpecDryRunFilter,
    SpecDryRunSubmitRequest,
    SpecDryRunSubmitResponse,
    SpecDryRunChangeBreakdown,
    SpecDryRunUnknown,
    SpecDryRunAffectedUser,
    SpecDryRunOperationalImplications,
    SpecDryRunReport,
    SpecDryRunJobProgress,
    SpecDryRunJobFailure,
    SpecDryRunJob,
} from './contracts';
