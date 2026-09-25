// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// ── State Machine ────────────────────────────────────────────────────────
//
// EVERY RESPONSE TYPE HERE IS DERIVED from the runtime API's OpenAPI document (through
// `generated/runtime.ts`), so there is one description of the `/runtime/state-machine/*` wire:
//   /runtime/state-machine/instances            (readonly)
//   /runtime/state-machine/events               (readonly)
//   /runtime/state-machine/transition-requests  (mutable)
//
// An optional key with no value is ABSENT from the response, not `null`.

import type {
    StateMachineEventListPayload,
    StateMachineEventPayload,
    StateMachineInstanceListPayload,
    StateMachineInstancePayload,
    TransitionRequestListPayload,
    TransitionRequestPayload,
    TransitionRequestCreateBodyPayload,
    TransitionRequestResolveBodyPayload,
    TransitionRequestStatusPayload,
} from '../generated';

/** One record-field state machine. Every property is always present and never `null`. */
export type StateMachineInstance = StateMachineInstancePayload;
export type StateMachineInstanceListResponse = StateMachineInstanceListPayload;
export type StateMachineInstanceResponse = StateMachineInstance;

export interface StateMachineEventListParams {
    entity_name?: string;
    instance_id?: string;
}

/** One recorded transition. */
export type StateMachineEvent = StateMachineEventPayload;
export type StateMachineEventListResponse = StateMachineEventListPayload;
export type StateMachineEventResponse = StateMachineEvent;

// ── Transition Requests ─────────────────────────────────────────────────

/** `pending | approved | rejected` — the generated union off the published enum. */
export type TransitionRequestStatus = TransitionRequestStatusPayload;

export interface TransitionRequestListParams {
    status?: TransitionRequestStatus;
    /**
     * Filter to requests whose `required_roles` intersect with any of the
     * supplied roles. Serialized as repeated query parameters.
     */
    roles?: string[];
}

/** A requested transition awaiting a decision. `transition_request_id`, not `id`. */
export type TransitionRequestItem = TransitionRequestPayload;
export type TransitionRequestListResponse = TransitionRequestListPayload;
export type TransitionRequestResponse = TransitionRequestItem;

/**
 * DERIVED from the runtime API's OpenAPI document, like everything else here.
 *
 * IT CARRIES NEITHER `flow_instance_id` NOR `instance_id` NOR `required_roles`. All three name
 * something the SERVER owns — the run a request is linked to, the machine it is about, and the
 * set that decides who may resolve it — and the route refuses each BY NAME with a 400.
 */
export type TransitionRequestCreateBody = TransitionRequestCreateBodyPayload;

/**
 * What the PATCH accepts, DERIVED from the published schema like everything else here. At
 * least one key is required — a body carrying none is refused *"patch body requires at least
 * one mutable field"*.
 *
 * `status`, not `decision`, and only `approved` or `rejected`: a resolution goes through
 * approval (the approver's authority is checked, the transition's rules are re-checked when it
 * commits, and a waiting flow resumes in the same transaction). `pending` is an outcome rather
 * than a request, and the route refuses it.
 *
 * There is no `resolved_by` or `resolved_at`: the approver is the authenticated caller and the
 * decision is dated by the server, so the route refuses both.
 */
export type TransitionRequestPatchBody = TransitionRequestResolveBodyPayload;

/**
 * What `resolveTransitionRequest()` takes: the wire body with the DECISION REQUIRED.
 *
 * The wire legitimately accepts a note-only patch — annotating a pending request changes no
 * state — but a method named `resolve` must resolve: without a required `status`,
 * `resolve(id, {decision_notes: 'looks good'})` would patch the note, leave the request
 * `pending`, and still type-check. Narrowing the METHOD is not a fiction about the wire; it is
 * the method saying what it is for.
 */
export type TransitionRequestResolveInput =
    Omit<TransitionRequestPatchBody, 'status'>
    & { status: NonNullable<TransitionRequestPatchBody['status']> };

/** The resolved request, in the same shape `GET` answers. */
export type TransitionRequestPatchResponse = TransitionRequestItem;
