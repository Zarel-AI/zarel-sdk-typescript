// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// Types for the `contract.treatment` family — the baseline treatment document, its
// `rails`, and the two normalized child collections (`vocabulary`, `profiles`).
//
// EVERY SHAPE HERE IS DERIVED from the contract API's OpenAPI document (through
// `generated/contract.ts`), so there is one description of the `/contract/treatment*` and
// `/contract/metadata` wire. The treatment document is closed: the route refuses keys it
// does not declare.
//
// THE READ AND THE WRITE ARE DIFFERENT SHAPES, and one type cannot be both.
// `ContractTreatment` (read) carries `vocabulary`, composed from the collection that owns it;
// `ContractTreatmentWrite` (write) refuses it, along with `profiles` and `rails`. A GET body is
// therefore not a legal PUT body, and the refusal names the route to use.
//
// The vocabulary collection (`/contract/treatment/vocabulary`) is the single source of the
// tenant's term list. Both collection DELETEs answer `{success, data: {message}}`.

import type {
    ContractTreatmentPatchPayload,
    ContractTreatmentRailsPatchPayload,
    ContractDeletedAckPayload,
    ContractProfileCreatePayload,
    ContractProfileWritePayload,
    ContractProfilePayload,
    ContractTenantMetadataPayload,
    ContractTenantMetadataWritePayload,
    ContractTreatmentPayload,
    ContractTreatmentRailsPayload,
    ContractTreatmentWritePayload,
    ContractVocabularyCreatePayload,
    ContractVocabularyEntryPayload,
    ContractVocabularyWritePayload,
} from '../generated';

/**
 * The baseline conversation treatment as the READ answers it: the mergeable fields, plus
 * `vocabulary` composed from `/contract/treatment/vocabulary`. `vocabulary` is ABSENT when
 * that collection is empty — never present-and-empty, and never a stale copy from an older
 * publish.
 */
export type ContractTreatment = ContractTreatmentPayload;

/**
 * The PATCH bodies. Deliberately NOT the write types: RFC 7396 reads `null` as a REMOVAL,
 * and it is the only way to clear a field. Typing both verbs with the write body made
 * `patch({persona: null})` a compile error on a route that answers 200 with the key gone.
 *
 * A NESTED removal (`{style: {tone: null}}`) is expressible too: every nested value
 * names a `*Patch` sibling whose properties admit `null`, so clearing one key inside `style` and
 * leaving its siblings standing compiles and answers 200.
 *
 * TWO PLACES IT DOES NOT, and both are the schema telling the truth rather than a gap.
 * `hard_refusals` requires both its keys on the MERGED value, so clearing either would leave a
 * document the server refuses in every stored state — clear `hard_refusals` whole instead. And
 * `drift_detection.max_turns_without_domain_action` carries a server-side default, so a `null` there is
 * accepted and RE-DEFAULTED rather than removed; only `{drift_detection: null}` clears it.
 */
export type ContractTreatmentPatch = ContractTreatmentPatchPayload;
export type ContractTreatmentRailsPatch = ContractTreatmentRailsPatchPayload;

/**
 * The PUT/PATCH body. Deliberately NOT `ContractTreatment`: `vocabulary`, `profiles` and
 * `rails` are refused here, each by name, each pointing at the route that owns it.
 */
export type ContractTreatmentWrite = ContractTreatmentWritePayload;

/** The non-overridable half of the treatment, applied AFTER any profile merge. */
export type ContractTreatmentRails = ContractTreatmentRailsPayload;

/** One vocabulary entry, as every `/contract/treatment/vocabulary*` route answers it. */
export type ContractVocabularyEntry = ContractVocabularyEntryPayload;

/** The POST body — both fields required. */
export type ContractVocabularyCreate = ContractVocabularyCreatePayload;

/**
 * The PUT/PATCH body for an existing entry. `means` is required by PUT (a total write states
 * its value) and optional in a PATCH; `term` is accepted so a read round-trips, and is
 * immutable.
 */
export type ContractVocabularyWrite = ContractVocabularyWritePayload;

/** One treatment profile — a named partial override, stored as one blob. */
export type ContractProfile = ContractProfilePayload;

/**
 * The PUT/PATCH body for a profile — the flat treatment.
 *
 * DISTINCT FROM `ContractTreatmentWrite`, and the difference is `vocabulary`: the baseline
 * write refuses it (the tenant's list is its own collection, `/contract/treatment/vocabulary`),
 * while a profile's list is an OVERRIDE that is appended to the baseline's and has no collection
 * of its own.
 */
export type ContractProfileWrite = ContractProfileWritePayload;

/**
 * The POST body — `ContractProfileWrite` plus `name`.
 *
 * NO `channels`: a profile's channel membership is not written by any route of the contract
 * API.
 */
export type ContractProfileCreate = ContractProfileCreatePayload;

/**
 * The tenant metadata composite. `label` is RESOLVED from the contract's semantic labels
 * against the request locale — it is not writable here.
 */
export type ContractTenantMetadata = ContractTenantMetadataPayload;

/** The PUT/PATCH body for the metadata composite. `label` is refused. */
export type ContractTenantMetadataWrite = ContractTenantMetadataWritePayload;

/** What both collection DELETEs answer. Not `void`. */
export type ContractDeletedAck = ContractDeletedAckPayload;
