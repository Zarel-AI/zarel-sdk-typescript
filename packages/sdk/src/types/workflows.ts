// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// ── Workflows (service-endpoint only) ────────────────────────────────────
//
// Request/response shapes of the state-machine replay operation
// (`POST /runtime/state-machine/replay`). Related types live elsewhere:
//   - state-machine event types  → ./state-machine.ts
//   - transition-request types   → ./state-machine.ts
//   - flow instance types        → ./flows.ts

export interface WorkflowTransitionRule {
    condition: string;
    description: string;
}

export interface WorkflowTransitionConfig {
    from: string;
    to: string;
    allowed_roles?: string[];
    rules?: WorkflowTransitionRule[];
}

export interface WorkflowStateMachineConfig {
    field: string;
    initial: string;
    transitions: WorkflowTransitionConfig[];
}

/**
 * NARROWER THAN THE WIRE, DELIBERATELY.
 *
 * `StateMachineReplayBody.new_config` is published OPEN — its keys are a state-machine
 * configuration the MCP `replay_workflow` tool validates, not a shape the document knows — so the
 * API accepts configurations this type refuses. Not derived from the document for that reason:
 * deriving would replace a helpful shape with `Record<string, unknown>` and hand every caller the
 * job the tool already does. Other request types are derived because their wire shape IS the
 * useful shape; here it is not.
 *
 * What that costs: if the tool's accepted configuration changes, this type does not follow
 * automatically. That is stated here rather than left for a reader to discover from a refused
 * request.
 */
export interface WorkflowReplayRequest {
    instance_id: string;
    new_config: WorkflowStateMachineConfig;
}

export interface WorkflowReplayEventResult {
    event_id: string;
    from_state: string;
    to_state: string;
    original_passed: boolean;
    replay_passed: boolean;
    diverged: boolean;
    reason?: string;
}

export interface WorkflowReplayResult {
    instance_id: string;
    total_events: number;
    diverged_count: number;
    events: WorkflowReplayEventResult[];
}

export interface WorkflowReplayEmptyResult {
    message: string;
    total_events: 0;
    diverged_count: 0;
    events: [];
}

export type WorkflowReplayResponse = WorkflowReplayResult | WorkflowReplayEmptyResult;
