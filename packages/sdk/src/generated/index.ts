// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// Thin curated re-export over the openapi-typescript output.
// The request and response types are derived from the Zarel API's OpenAPI documents
// (runtime API and contract API), generated into src/generated/{runtime,contract}.ts,
// never edited by hand, and each release regenerates them from those documents. Resources import
// these aliases — never the raw `components['schemas'][...]` nesting — and
// return them UNWRAPPED (the transport strips the {success,data} envelope).
//
// Do not hand-edit the generated runtime.ts / contract.ts; they are regenerated from the
// OpenAPI documents. This file (hand-authored) maps schema names → stable
// SDK-facing aliases.
import type { components as ContractComponents } from './contract';
import type { components as RuntimeComponents } from './runtime';

type ContractSchema<K extends keyof ContractComponents['schemas']> = ContractComponents['schemas'][K];
type RuntimeSchema<K extends keyof RuntimeComponents['schemas']> = RuntimeComponents['schemas'][K];

// ── Contract plane ───────────────────────────────────────────────────────
export type RolePayload = ContractSchema<'RoleRecord'>;
export type RoleListPayload = RolePayload[];
// The two WRITE shapes, derived from the published schema like the payload. A role has no
// `label` on these routes, and the server refuses the key by name.
export type RoleCreatePayload = ContractSchema<'RoleCreate'>;
export type RoleWritePayload = ContractSchema<'RoleWrite'>;

export type ContractPolicyPayload = ContractSchema<'ContractPolicyRow'>;
export type ContractPolicyListPayload = ContractPolicyPayload[];

export type EntityPolicyPayload = ContractSchema<'EntityPolicyRow'>;
export type EntityPolicyListPayload = EntityPolicyPayload[];

export type LlmServicePolicyPayload = ContractSchema<'LlmServicePolicy'>;
export type LlmServicePolicyListPayload = LlmServicePolicyPayload[];

export type OwnerCeilingPayload = ContractSchema<'OwnerCeiling'>;

// ── Authorization grant WRITE bodies ─────────────────────────────────────────
// The request bodies of the grant write operations, one statement and one qualifier bag per
// grant family, plus the create body.
export type GrantStatementConfigPayload = ContractSchema<'ContractGrantStatementConfig'>;
export type GrantStatementRecordsPayload = ContractSchema<'ContractGrantStatementRecords'>;
export type GrantStatementFlowsPayload = ContractSchema<'ContractGrantStatementFlows'>;
export type GrantStatementLlmServicesPayload = ContractSchema<'ContractGrantStatementLlmServices'>;
export type GrantCreatePayload = ContractSchema<'ContractGrantCreateBody'>;
export type GrantQualifiersConfigPayload = ContractSchema<'ContractGrantQualifiersConfig'>;
export type GrantQualifiersRecordsPayload = ContractSchema<'ContractGrantQualifiersRecords'>;
export type GrantQualifiersFlowsPayload = ContractSchema<'ContractGrantQualifiersFlows'>;
export type GrantQualifiersLlmServicesPayload = ContractSchema<'ContractGrantQualifiersLlmServices'>;

// ── Skills / actions / flows WRITE bodies ────────────────────────────────────
// The request bodies of the skill, action and flow writes.
export type SkillWritePayload = ContractSchema<'ContractSkillWriteBody'>;
export type SkillPatchPayload = ContractSchema<'ContractSkillPatchBody'>;
export type ActionWritePayload = ContractSchema<'ContractActionWriteBody'>;
export type ActionPatchPayload = ContractSchema<'ContractActionPatchBody'>;
export type FlowWritePayload = ContractSchema<'ContractFlowWriteBody'>;
export type FlowPatchPayload = ContractSchema<'ContractFlowPatchBody'>;

// Contract-plane flows. `flows-contract.ts` re-exports these under their public names and
// declares no shape of its own.
export type ContractFlowPayload = ContractSchema<'ContractFlow'>;
export type ContractFlowStepPayload = ContractSchema<'ContractFlowStep'>;
// The nested families' WRITE shapes.
export type ContractFlowStepCreatePayload = ContractSchema<'FlowStepCreate'>;
export type ContractFlowStepWritePayload = ContractSchema<'FlowStepWrite'>;
export type ContractFlowOnCompletionCreatePayload = ContractSchema<'FlowOnCompletionCreate'>;
export type ContractFlowOnCompletionWritePayload = ContractSchema<'FlowOnCompletionWrite'>;
export type ContractFlowStepInlinePayload = ContractSchema<'ContractFlowStepInline'>;
export type ContractFlowOnCompletionPayload = ContractSchema<'ContractFlowOnCompletionEntry'>;
export type ContractFlowOnCompletionInlinePayload = ContractSchema<'ContractFlowOnCompletionInline'>;
export type ContractDeletedAckPayload = ContractSchema<'ContractDeletedAck'>;

// The treatment family: the treatment document, its rails, its vocabulary and its profiles.
export type ContractTreatmentPayload = ContractSchema<'ContractTreatment'>;
export type ContractTreatmentWritePayload = ContractSchema<'ContractTreatmentWrite'>;
export type ContractTreatmentRailsPayload = ContractSchema<'ContractTreatmentRails'>;
// The PATCH bodies. Every property nullable, because RFC 7396 reads `null` as a removal
// and it is the only way to clear a field; the replace bodies above forbid it.
export type ContractTreatmentPatchPayload = ContractSchema<'ContractTreatmentPatch'>;
export type ContractTreatmentRailsPatchPayload = ContractSchema<'ContractTreatmentRailsPatch'>;
export type ContractVocabularyEntryPayload = ContractSchema<'ContractVocabularyEntry'>;
export type ContractVocabularyCreatePayload = ContractSchema<'ContractVocabularyCreate'>;
export type ContractVocabularyWritePayload = ContractSchema<'ContractVocabularyWrite'>;
export type ContractProfilePayload = ContractSchema<'ContractProfile'>;
export type ContractProfileWritePayload = ContractSchema<'ContractProfileWrite'>;
export type ContractProfileCreatePayload = ContractSchema<'ContractProfileCreate'>;
export type ContractVocabularyTermPayload = ContractSchema<'ContractVocabularyTerm'>;
export type ContractTenantMetadataPayload = ContractSchema<'ContractTenantMetadata'>;
export type ContractTenantMetadataWritePayload = ContractSchema<'ContractTenantMetadataWrite'>;

// The contract singletons whose write bodies are published. WRITE ONLY, and deliberately: the
// three GETs still publish a bare `OkEnvelope`, so there is no read shape to alias yet and
// pretending otherwise would put a type on a response nothing binds.
export type ContractProcessModelWritePayload = ContractSchema<'ContractProcessModelWrite'>;
export type ContractLlmWritePayload = ContractSchema<'ContractLlmWrite'>;
export type ContractProcessModelPatchPayload = ContractSchema<'ContractProcessModelPatch'>;
export type ContractLlmPatchPayload = ContractSchema<'ContractLlmPatch'>;
export type ContractTimezoneWritePayload = ContractSchema<'ContractTimezoneWrite'>;
export type FlowPolicyPayload = ContractSchema<'FlowPolicyRow'>;

export type CapabilityPayload = ContractSchema<'CapabilityRecord'>;
export type CapabilityListPayload = CapabilityPayload[];
export type ConstraintPayload = ContractSchema<'ConstraintRecord'>;
export type ConstraintListPayload = ConstraintPayload[];
export type SchemaPayload = ContractSchema<'SchemaRecord'>;
export type SchemaListPayload = SchemaPayload[];
export type McpServerPayload = ContractSchema<'McpServerRecord'>;
export type McpServerListPayload = McpServerPayload[];
export type McpAllowedToolPayload = ContractSchema<'McpAllowedToolRecord'>;
export type McpAllowedToolListPayload = McpAllowedToolPayload[];
export type EventRulePayload = ContractSchema<'EventRuleRecord'>;
export type EventRuleListPayload = EventRulePayload[];
export type PhasePayload = ContractSchema<'PhaseRecord'>;
export type PhaseListPayload = PhasePayload[];

// The REQUEST side of the four flat collections (capabilities, constraints, schemas and
// process-model phases).
export type CapabilityCreatePayload = ContractSchema<'CapabilityCreate'>;
export type CapabilityWritePayload = ContractSchema<'CapabilityWrite'>;
export type ConstraintCreatePayload = ContractSchema<'ConstraintCreate'>;
export type ConstraintWritePayload = ContractSchema<'ConstraintWrite'>;
export type SchemaCreatePayload = ContractSchema<'SchemaCreate'>;
export type SchemaWritePayload = ContractSchema<'SchemaWrite'>;
export type PhaseEntryConditionPayload = ContractSchema<'PhaseEntryCondition'>;
export type PhaseActionScopePayload = ContractSchema<'PhaseActionScope'>;
export type PhaseCreatePayload = ContractSchema<'PhaseCreate'>;
export type PhaseWritePayload = ContractSchema<'PhaseWrite'>;

// The REQUEST side of `mcp-servers`, its nested `allowed-tools` and `events/rules`,
// plus the two NESTED shapes their records carry, each published as its own named schema.
export type McpRetryPolicyPayload = ContractSchema<'McpRetryPolicy'>;
export type McpServerCreatePayload = ContractSchema<'McpServerCreate'>;
export type McpServerWritePayload = ContractSchema<'McpServerWrite'>;
export type McpAllowedToolCreatePayload = ContractSchema<'McpAllowedToolCreate'>;
export type McpAllowedToolWritePayload = ContractSchema<'McpAllowedToolWrite'>;
export type WebhookEventEffectPayload = ContractSchema<'WebhookEventEffect'>;
export type FlowEventEffectPayload = ContractSchema<'FlowEventEffect'>;
export type EventRuleEffectPayload = ContractSchema<'EventRuleEffect'>;
export type EventRuleWritePayload = ContractSchema<'EventRuleWrite'>;
export type EventRulePatchPayload = ContractSchema<'EventRulePatch'>;
export type RecordCreatedRulePayload = ContractSchema<'RecordCreatedRuleRecord'>;
export type RecordUpdatedRulePayload = ContractSchema<'RecordUpdatedRuleRecord'>;
export type RecordDeletedRulePayload = ContractSchema<'RecordDeletedRuleRecord'>;
export type StateTransitionedRulePayload = ContractSchema<'StateTransitionedRuleRecord'>;
export type SystemEventRulePayload = ContractSchema<'SystemEventRuleRecord'>;

// Batch.
export type BatchOperationPayload = ContractSchema<'BatchOperation'>;
export type BatchRequestPayload = ContractSchema<'BatchRequest'>;
export type BatchResponseItemPayload = ContractSchema<'BatchResponseItem'>;
export type BatchResponsePayload = ContractSchema<'BatchResponse'>;

// Entities. These point at the schemas the entity routes answer.
/**
 * The field-type vocabulary, as the contract plane PUBLISHES it.
 *
 * The contract API's OpenAPI document carries it as an enum, kept equal to the field types a
 * contract accepts. It is exported so a consumer can name a field type without restating the
 * union.
 */
export type ContractFieldTypeName = ContractSchema<'ContractFieldTypeName'>;

export type EntityFieldRefPayload = ContractSchema<'ContractEntityFieldRef'>;
export type EntityFieldPayload = ContractSchema<'ContractEntityField'>;
export type EntityFieldListPayload = ContractSchema<'ContractEntityFieldList'>;
export type EntitySummaryPayload = ContractSchema<'ContractEntitySummary'>;
export type EntityListPayload = ContractSchema<'ContractEntityList'>;
export type EntityPayload = ContractSchema<'ContractEntityDetail'>;
export type EntityRecordPayload = ContractSchema<'ContractEntityRecord'>;
export type EntityFieldRecordPayload = ContractSchema<'ContractEntityFieldRecord'>;
export type FieldTransitionPayload = ContractSchema<'ContractFieldTransition'>;
// ── Field transition WRITE bodies ────────────────────────────────────────────
// The server validates these bodies with the same rules a contract publish applies.
export type FieldTransitionCreatePayload = ContractSchema<'ContractFieldTransitionCreateBody'>;
export type FieldTransitionWritePayload = ContractSchema<'ContractFieldTransitionWriteBody'>;
export type FieldTransitionPatchPayload = ContractSchema<'ContractFieldTransitionPatchBody'>;

// The REQUEST side of the same family. The bodies are CLOSED: a key they do not declare is
// refused.
export type EntityCreateBodyPayload = ContractSchema<'ContractEntityCreateBody'>;
// PUT and PATCH are DIFFERENT bodies, not one shared shape: a replace REQUIRES every mutable
// key. No read on this surface returns everything (none carries an entity's `checks` or a
// field's `position`/`transitions`), so clear-by-omission would destroy state a caller cannot
// see — the keys are required instead, and `null` clears explicitly.
export type EntityReplaceBodyPayload = ContractSchema<'ContractEntityReplaceBody'>;
export type EntityPatchBodyPayload = ContractSchema<'ContractEntityPatchBody'>;
export type EntityFieldCreateBodyPayload = ContractSchema<'ContractEntityFieldCreateBody'>;
export type EntityFieldReplaceBodyPayload = ContractSchema<'ContractEntityFieldReplaceBody'>;
export type EntityFieldPatchBodyPayload = ContractSchema<'ContractEntityFieldPatchBody'>;

// ── Runtime plane ──────────────────────────────────────────────────────────
export type RoleAssignmentPayload = RuntimeSchema<'RoleAssignment'>;
export type RoleAssignmentListPayload = RoleAssignmentPayload[];

// Flows. These are the `data` of `/runtime/flows/*`. `types/flows.ts` re-exports these
// under their public names; it declares no shape of its own.
// State machine. The published shapes of state-machine instances, events and transition
// requests, including the `TransitionRequestStatus` vocabulary.
export type StateMachineInstancePayload = RuntimeSchema<'StateMachineInstance'>;
export type StateMachineEventPayload = RuntimeSchema<'StateMachineEvent'>;
export type TransitionRequestPayload = RuntimeSchema<'TransitionRequest'>;
export type TransitionRequestStatusPayload = RuntimeSchema<'TransitionRequestStatus'>;
export type StateMachineInstanceListPayload = RuntimeSchema<'StateMachineInstanceList'>;
export type StateMachineEventListPayload = RuntimeSchema<'StateMachineEventList'>;
export type TransitionRequestListPayload = RuntimeSchema<'TransitionRequestList'>;
// The REQUEST side of the same operation. It has no `resolved_by` or `resolved_at`: the server
// records who resolved a request and when, and refuses those keys.
export type TransitionRequestResolveBodyPayload = RuntimeSchema<'TransitionRequestResolveBody'>;

// ── Conversation WRITE bodies ────────────────────────────────────────────────
// `session_key` is required on send; the route answers 400 without it.
export type ConversationSendBodyPayload = RuntimeSchema<'ConversationSendBody'>;
export type ConversationSessionCreateBodyPayload = RuntimeSchema<'ConversationSessionCreateBody'>;

// ── Subscriptions, callbacks, transition requests ────────────────────────────
// A subscription `secret` must be a string. On a transition-request create, `flow_instance_id`,
// `instance_id` and `required_roles` are chosen by the server and refused if sent.
export type EventSubscriptionCreateBodyPayload = RuntimeSchema<'EventSubscriptionCreateBody'>;
export type EventSubscriptionPatchBodyPayload = RuntimeSchema<'EventSubscriptionPatchBody'>;
export type FlowCallbackResolveBodyPayload = RuntimeSchema<'FlowCallbackResolveBody'>;
export type TransitionRequestCreateBodyPayload = RuntimeSchema<'TransitionRequestCreateBody'>;

export type FlowInstancePayload = RuntimeSchema<'FlowInstance'>;
export type FlowEventPayload = RuntimeSchema<'FlowEvent'>;
export type FlowEventKindPayload = RuntimeSchema<'FlowEventKind'>;
export type FlowCallbackPayload = RuntimeSchema<'FlowCallback'>;

// SSE event types for `client.runtime.events.stream` / `.iterate`.
export type SseConversationTurnCreatedPayload = RuntimeSchema<'RuntimeSseConversationTurnCreatedPayload'>;
export type SseConversationTurnCreatedData = RuntimeSchema<'RuntimeSseConversationTurnCreatedData'>;
