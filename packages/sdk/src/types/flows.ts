// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// ── Flows ────────────────────────────────────────────────────────────────
//
// THIS FILE DECLARES NO SHAPE. Every type below is the generated projection of
// the published response schema (the runtime API's OpenAPI document →
// `generated/runtime.ts`), so there is exactly one description of the
// `/runtime/flows/*` wire and the SDK cannot disagree with it. Nullable fields
// such as `error`, `step_name`, `output_key` and `duration_ms` arrive as `null`,
// not absent.

import type {
    FlowCallbackPayload,
    FlowCallbackResolveBodyPayload,
    FlowEventKindPayload,
    FlowEventPayload,
    FlowInstancePayload,
} from '../generated';

/** A flow run, as the route sends it. */
export type FlowInstance = FlowInstancePayload;

/**
 * One appended flow lifecycle event — where per-step history lives. A step is an
 * event whose `step_name` is set and whose `event_type` is one of the `FlowStep*`
 * kinds.
 */
export type FlowEvent = FlowEventPayload;

/**
 * The persisted flow-event vocabulary, as a union.
 *
 * Derived from the runtime API's OpenAPI enum, not copied by hand: the SDK is
 * dependency-free and does not import `@zarel-ai/contract`, where the vocabulary
 * is defined.
 */
export type FlowEventKind = FlowEventKindPayload;

/** A suspended flow's resumption point. The `id` is the capability token. */
export type FlowCallback = FlowCallbackPayload;

/**
 * The body `PATCH /runtime/flows/callbacks/{id}` accepts — a CLOSED, enumerable pair, which is
 * why it is a union and not a bag. DERIVED from the runtime API's OpenAPI document.
 *
 * The route refuses anything whose `action` is not `'complete'` or `'fail'`, and for `complete`
 * requires `payload` to be a plain object. It settles the callback in opposite directions
 * depending on `action`.
 */
export type FlowCallbackResolution = FlowCallbackResolveBodyPayload;

// The routes return the bare array / object as the envelope's `data`, which the
// transport unwraps — these aliases are what a caller actually receives.
export type FlowInstanceListResponse = FlowInstance[];
export type FlowInstanceResponse = FlowInstance;
export type FlowEventListResponse = FlowEvent[];
export type FlowEventResponse = FlowEvent;
export type FlowCallbackListResponse = FlowCallback[];
export type FlowCallbackResponse = FlowCallback;
