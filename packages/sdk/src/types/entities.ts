// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// ── Entities ─────────────────────────────────────────────────────────────
//
// EVERY SHAPE HERE IS DERIVED from the contract API's OpenAPI document (through
// `generated/contract.ts`), so there is one description of the `/contract/entities*` wire, as in
// `types/flows-contract.ts`.
//
// `label` and `description` are not accepted on these bodies: an entity's semantic content is
// written by a contract publish.
//
// The bodies are published and CLOSED now (`additionalProperties: false`, enforced by the route,
// which names every key it refuses), so these are aliases rather than declarations.

import type {
    EntityCreateBodyPayload,
    EntityFieldCreateBodyPayload,
    EntityFieldListPayload,
    EntityFieldPayload,
    EntityFieldRecordPayload,
    EntityFieldRefPayload,
    EntityFieldPatchBodyPayload,
    EntityFieldReplaceBodyPayload,
    EntityListPayload,
    EntityPayload,
    EntityRecordPayload,
    EntityPatchBodyPayload,
    EntityReplaceBodyPayload,
    EntitySummaryPayload,
    FieldTransitionPayload,
} from '../generated';

// ── The RESPONSE side ────────────────────────────────────────────────────
//
// Public names for what `/contract/entities*` answers. Aliases, not declarations — the published
// schema is the description and there is exactly one.
//
// TWO FIELD SHAPES, AND THAT IS THE WHOLE POINT. `ContractEntityField` is what every READ answers
// (the entity detail's `fields[]`, `listFields`, `getField` — one shape, resolved at the requested
// locale), and `ContractEntityFieldRecord` is what every MUTATION answers (the stored definition:
// `field_type`, `is_required`, `position`, timestamps). They are not folded together because a
// write reports what it PERSISTED and the read comes from a cached view a just-committed write
// has not necessarily reached. `ContractEntityFieldRef` is the `{name, type}` summary the entity
// LIST carries.

/** One entity in `GET /contract/entities`. */
export type ContractEntitySummary = EntitySummaryPayload;
/** The payload of `GET /contract/entities`. */
export type ContractEntityList = EntityListPayload;
/** The payload of `GET /contract/entities/{entity_name}`. */
export type ContractEntity = EntityPayload;
/** A field as every READ answers it. */
export type ContractEntityField = EntityFieldPayload;
/** A field as the entity LIST names it — `{name, type}`. */
export type ContractEntityFieldRef = EntityFieldRefPayload;
/** The payload of `GET /contract/entities/{entity_name}/fields`. */
export type ContractEntityFieldList = EntityFieldListPayload;
/** An entity as every MUTATION answers it — the stored definition, `i18n` hydrated. */
export type ContractEntityRecord = EntityRecordPayload;
/** A field as every MUTATION answers it — the stored definition, `i18n` hydrated. */
export type ContractEntityFieldRecord = EntityFieldRecordPayload;
/** One transition edge, as the `/transitions*` routes answer it. */
export type ContractFieldTransition = FieldTransitionPayload;

/** `POST /contract/entities`. */
export type EntityInput = EntityCreateBodyPayload;

/**
 * `PUT /contract/entities/{entity_name}` — a TOTAL declaration.
 *
 * Every mutable property is REQUIRED, and that is not pedantry: no read on this surface returns
 * `display_field`, `semantic_triggers`, `tool_hints` or `checks`, so a caller cannot GET-edit-PUT
 * and an omitted key read as "clear it" would destroy an entity's write-time verdicts
 * with nothing in any response to show it. `null` clears, explicitly.
 */
export type EntityReplaceInput = EntityReplaceBodyPayload;

/**
 * `PATCH /contract/entities/{entity_name}` — a partial. An absent key is untouched; `null` clears.
 *
 * A separate type from {@link EntityInput}, not `Partial<EntityInput>`: `name` is the PATH identity
 * on this side, optional and not mutable, while it is required on create. `Partial<>` said neither.
 */
export type EntityWriteInput = EntityPatchBodyPayload;

/** `POST /contract/entities/{entity_name}/fields`. */
export type FieldDefinitionInput = EntityFieldCreateBodyPayload;

/**
 * `PUT /contract/entities/{entity_name}/fields/{field_name}` — a TOTAL declaration, every mutable
 * property required. See {@link EntityReplaceInput} for why; `ContractEntityField` returns neither
 * `position` nor `transitions`, so an omission cannot mean "clear it".
 */
export type FieldReplaceInput = EntityFieldReplaceBodyPayload;

/**
 * `PATCH /contract/entities/{entity_name}/fields/{field_name}` — a partial.
 *
 * `name` and `field_type` are identity here — a body may repeat either and is REFUSED when it
 * disagrees, because no update path writes a field's type.
 */
export type FieldWriteInput = EntityFieldPatchBodyPayload;

// ── Contracts ────────────────────────────────────────────────────────────
// The contracts wire types live in `./contracts`. This file keeps only
// `ToolExecutionResult` (the generic envelope used by non-contract
// management calls).

export interface ToolExecutionResult {
    success: boolean;
    data?: unknown;
    error?: string;
}
