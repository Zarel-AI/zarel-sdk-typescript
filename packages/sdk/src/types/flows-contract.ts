// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// Types for the `contract.flows` resource. Flow *definitions* live on the contract plane
// (`contract.flows`); flow *instances/runs* are runtime-plane and typed in `./flows`.
//
// EVERY SHAPE HERE IS DERIVED from the contract API's OpenAPI document (through
// `generated/contract.ts`), so there is one description of the `/contract/flows*` wire.
//
// A step has TWO shapes: nested inside a flow it carries no `tenant_name`, `flow_name` or
// `position`; from `/contract/flows/{f}/steps` it carries all three. On-completion entries
// likewise. The child DELETEs answer `{success, data: {message}}`, not an empty body.

import type {
    FlowPatchPayload,
    FlowWritePayload,
    ContractDeletedAckPayload,
    ContractFlowOnCompletionCreatePayload,
    ContractFlowOnCompletionInlinePayload,
    ContractFlowOnCompletionPayload,
    ContractFlowOnCompletionWritePayload,
    ContractFlowPayload,
    ContractFlowStepCreatePayload,
    ContractFlowStepInlinePayload,
    ContractFlowStepPayload,
    ContractFlowStepWritePayload,
} from '../generated';

/** One flow, as every `/contract/flows*` parent route answers it — list, get, create, replace
 *  and patch all send this same shape. */
export type ContractFlow = ContractFlowPayload;

/** A step nested inside a flow object: no `tenant_name` or `flow_name`, no `position`. */
export type ContractFlowStepInline = ContractFlowStepInlinePayload;
/** A step from the dedicated `/steps` routes: with `tenant_name`, `flow_name` and `position`. */
export type ContractFlowStep = ContractFlowStepPayload;

/** An on_completion entry nested inside a flow object. */
export type ContractFlowOnCompletionInline = ContractFlowOnCompletionInlinePayload;
/** An on_completion entry from the dedicated routes: the full stored entry. */
export type ContractFlowOnCompletion = ContractFlowOnCompletionPayload;

/** What a contract DELETE answers — flow, skill, action and the two flow children.
 *  Not an empty body. */
export type ContractDeletedAck = ContractDeletedAckPayload;

/** The upsert body `POST /contract/flows` and `PUT /contract/flows/{flow_name}` accept.
 *  DERIVED from the contract API's OpenAPI document. */
export type ContractFlowInput = FlowWritePayload;
/** `PATCH /contract/flows/{flow_name}` — every key optional, `name` restatable and not changeable. */
export type ContractFlowPatchInput = FlowPatchPayload;

/** `POST /contract/flows/{flow_name}/steps`. `flow_name` may be echoed and must agree. */
export type ContractFlowStepCreate = ContractFlowStepCreatePayload;
/** `PUT` / `PATCH` on one step — one shape for both, because both MERGE. */
export type ContractFlowStepWrite = ContractFlowStepWritePayload;
/** `POST /contract/flows/{flow_name}/on-completion`. */
export type ContractFlowOnCompletionCreate = ContractFlowOnCompletionCreatePayload;
/** `PUT` / `PATCH` on one on-completion entry. */
export type ContractFlowOnCompletionWrite = ContractFlowOnCompletionWritePayload;
