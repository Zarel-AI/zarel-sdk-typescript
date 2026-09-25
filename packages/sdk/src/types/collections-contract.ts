// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// Types for the four flat contract collections — `capabilities`, `schemas`, `constraints`
// and `process-model/phases`.
//
// EVERY SHAPE HERE IS DERIVED from the contract API's OpenAPI document (through
// `generated/contract.ts`), so there is one description of the
// `/contract/{capabilities,schemas,constraints,process-model/phases}*` wire, not several.
// Do not hand-write these types or add a `[key: string]: unknown` index signature: it admits
// every property, so no field could be missing and no field could be wrong.
//
// Labels and descriptions are not part of these records; they are written by a contract
// publish. `tenant_name` and `is_active` are on the wire; the server sets `tenant_name`, it is
// not a filter the caller supplies.
//
// The READ and the WRITE are different shapes, but a GET body IS a legal write body: `tenant_name`
// and `name` are accepted on both verbs as an identity ECHO, refused when they DISAGREE with the
// request, and never merely ignored. Read-modify-write is the ordinary idiom, and refusing the two
// keys the caller just read would make them strip what they did not add.

import type {
    CapabilityCreatePayload,
    CapabilityPayload,
    CapabilityWritePayload,
    ConstraintCreatePayload,
    ConstraintPayload,
    ConstraintWritePayload,
    PhaseActionScopePayload,
    PhaseCreatePayload,
    PhaseEntryConditionPayload,
    PhasePayload,
    PhaseWritePayload,
    SchemaCreatePayload,
    SchemaPayload,
    SchemaWritePayload,
} from '../generated';

/** One live capability, as every `/contract/capabilities*` route answers it. */
export type CapabilityRecord = CapabilityPayload;

/**
 * The POST body: a union with one branch per capability kind, selected by `type`. Each branch
 * requires what the server's capability validation requires for that kind —
 * `entity_action` needs `action_ref` + `entity`, every other kind a `config` in its own shape.
 * The route still judges the body, and a declaration outside the union is a 400, because a
 * capability nothing matches would be stored and silently ignored.
 */
export type CapabilityCreate = CapabilityCreatePayload;

/**
 * The PUT/PATCH body. Both verbs MERGE — an omitted property is left alone, not cleared — so
 * `replaceCapability` is a replace in name only. A body naming nothing is a 400; a body whose
 * RESULT leaves the union is a 422, judged after the merge because the pairing needs the stored
 * capability.
 */
export type CapabilityWrite = CapabilityWritePayload;

/** One live schema — a transient schema referenced by flows and capabilities. */
export type SchemaRecord = SchemaPayload;

/** The POST body. `definition` is validated server-side as a transient schema definition. */
export type SchemaCreate = SchemaCreatePayload;

/** The PUT/PATCH body. Both verbs MERGE; `definition` cannot be cleared. */
export type SchemaWrite = SchemaWritePayload;

/** One live constraint. */
export type ConstraintRecord = ConstraintPayload;

/**
 * The POST body. `type` and `rule` are a closed PAIR, not two alphabets: every
 * enforcer guards on the pair, so a valid type with the wrong rule matches nothing.
 */
export type ConstraintCreate = ConstraintCreatePayload;

/**
 * The PUT/PATCH body. Both verbs MERGE. A one-sided change to `type` or `rule` is resolved
 * against the stored constraint and refused with 422 if the resulting pair is not declared.
 */
export type ConstraintWrite = ConstraintWritePayload;

/** One `entry_conditions[]` member. */
export type PhaseEntryCondition = PhaseEntryConditionPayload;

/**
 * What a phase permits. Published as its own named schema in the contract API's OpenAPI
 * document.
 */
export type PhaseActionScope = PhaseActionScopePayload;

/** One live process-model phase. No `label`, no `description`, no `is_active`. */
export type PhaseRecord = PhasePayload;

/** The POST body. `position` is REQUIRED — a default would give every phase the same position. */
export type PhaseCreate = PhaseCreatePayload;

/** The PUT/PATCH body. Both verbs MERGE; `position` cannot be cleared. */
export type PhaseWrite = PhaseWritePayload;
