// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// Types for `mcp-servers`, its nested `allowed-tools`, and `events/rules`.
//
// EVERY SHAPE HERE IS DERIVED from the contract API's OpenAPI document (through
// `generated/contract.ts`), so there is one description of these eighteen operations' wire.
// Do not hand-write these types or add a `[key: string]: unknown` index signature: it admits
// every property, so no field could be missing and no field could be wrong.
//
// There is no `description` on an allowed tool: semantic content is written by a contract
// publish. `tenant_name` and `is_active` are always on the wire, and `McpServerRecord.timeout_ms`
// is always present (the server default is `30000`). The DELETEs answer
// `{success, data: {message}}`, not an empty body.
//
// The READ and the WRITE are different shapes, but a GET body IS a legal write body:
// `tenant_name` and the path keys are accepted on the write verbs as an identity ECHO, refused
// when they DISAGREE with the request, and never merely ignored.

import type {
    EventRuleEffectPayload,
    EventRulePatchPayload,
    EventRulePayload,
    EventRuleWritePayload,
    FlowEventEffectPayload,
    McpAllowedToolCreatePayload,
    McpAllowedToolPayload,
    McpAllowedToolWritePayload,
    McpRetryPolicyPayload,
    McpServerCreatePayload,
    McpServerPayload,
    McpServerWritePayload,
    RecordCreatedRulePayload,
    RecordDeletedRulePayload,
    RecordUpdatedRulePayload,
    StateTransitionedRulePayload,
    SystemEventRulePayload,
    WebhookEventEffectPayload,
} from '../generated';

/** The `retry` object. Two known members over an open bag, because that is what the API accepts and returns. */
export type McpRetryPolicy = McpRetryPolicyPayload;

/** One live MCP server, as every `/contract/mcp-servers*` route answers it. */
export type McpServerRecord = McpServerPayload;

/** The POST body. An omitted `timeout_ms` takes the server default (`30000`), on a create and on a resurrect. */
export type McpServerCreate = McpServerCreatePayload;

/** The PUT/PATCH body. Both verbs MERGE; only `url` and `retry` accept `null` to clear. */
export type McpServerWrite = McpServerWritePayload;

/** One live allowed tool of an MCP server. There is no `description`. */
export type McpAllowedToolRecord = McpAllowedToolPayload;

/** The POST body — identity is split, `namespace` from the path and `tool_name` from here. */
export type McpAllowedToolCreate = McpAllowedToolCreatePayload;

/** The PUT/PATCH body. Both verbs MERGE; the three object-valued properties accept `null` to clear. */
export type McpAllowedToolWrite = McpAllowedToolWritePayload;

/** An outbound notification effect. */
export type WebhookEventEffect = WebhookEventEffectPayload;

/** A `flow.start` effect, run as the occurrence actor or an opt-in definer-rights role. */
export type FlowEventEffect = FlowEventEffectPayload;

/** One `do[]` member — discriminated on `type`. */
export type EventRuleEffect = EventRuleEffectPayload;

/**
 * One live event rule, with its ordered `do[]`.
 *
 * A DISCRIMINATED UNION on `on`, not an open bag: the five members below are the five the
 * contract's `events.rules` section declares, and each is closed. Switching over `rule.on` narrows
 * to the trigger keys that variant actually carries — `entity` on the three record kinds,
 * `field`/`from`/`to` on a transition, `event`/`flow` on a system event.
 */
export type EventRuleRecord = EventRulePayload;

export type RecordCreatedRule = RecordCreatedRulePayload;
export type RecordUpdatedRule = RecordUpdatedRulePayload;
export type RecordDeletedRule = RecordDeletedRulePayload;
export type StateTransitionedRule = StateTransitionedRulePayload;
export type SystemEventRule = SystemEventRulePayload;

/**
 * The POST and PUT body — a rule is written WHOLE by both.
 *
 * `PUT` is a TOTAL write: the server clears every trigger key the new rule does not carry, so
 * an omitted `condition` is CLEARED and read-modify-PUT must send back everything it
 * means to keep. This is the one granular collection where `replace` is not a merge.
 */
export type EventRuleWrite = EventRuleWritePayload;

/**
 * The PATCH body — merged onto the STORED rule before the union judges the result whole.
 *
 * Wider than any single variant on purpose: which keys are legal depends on the stored `on`,
 * which no request schema can see. Changing `on` is refused by name.
 */
export type EventRulePatch = EventRulePatchPayload;
