// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
export type {
    ConversationRequest,
    ConversationResponse,
    ConversationTurn,
    InteractionContext,
    ConversationDebugInfo,
} from './conversation';

export type {
    ActionDispatchParams,
    ActionDispatchSuccessResponse,
} from './actions';

export type {
    ConfirmationGuard,
    ConfirmationChallenge,
    ConfirmationRetryOptions,
} from './confirmation';

export type {
    ToolCatalogResponse,
    McpToolsResponse,
    ToolCallRequest,
    ToolCallResponse,
    UserToolCatalog,
    UserVisibleEntityTool,
    UserVisibleAction,
    UserVisibleTransitionTool,
    TransitionEdge,
    UserVisibleActionTool,
    FieldToolDefinition,
    McpToolDefinition,
} from './tools';

export type {
    WorkflowReplayRequest,
    WorkflowReplayResponse,
    WorkflowReplayResult,
    WorkflowReplayEmptyResult,
    WorkflowReplayEventResult,
    WorkflowStateMachineConfig,
    WorkflowTransitionConfig,
    WorkflowTransitionRule,
} from './workflows';

export type {
    StateMachineInstance,
    StateMachineInstanceListResponse,
    StateMachineInstanceResponse,
    StateMachineEventListParams,
    StateMachineEvent,
    StateMachineEventListResponse,
    StateMachineEventResponse,
    TransitionRequestStatus,
    TransitionRequestListParams,
    TransitionRequestItem,
    TransitionRequestListResponse,
    TransitionRequestResponse,
    TransitionRequestCreateBody,
    TransitionRequestPatchBody,
    TransitionRequestResolveInput,
    TransitionRequestPatchResponse,
} from './state-machine';

export type {
    FlowInstance,
    FlowInstanceListResponse,
    FlowInstanceResponse,
    FlowEvent,
    FlowEventKind,
    FlowEventListResponse,
    FlowEventResponse,
    FlowCallback,
    FlowCallbackListResponse,
    FlowCallbackResolution,
    FlowCallbackResponse,
} from './flows';

export type {
    RecordData,
    RefLabel,
    RecordListParams,
    RecordListResponse,
    RecordResponse,
} from './records';

// The contract-plane flow types, and `ContractDeletedAck` — the shape EVERY contract DELETE
// answers, on every family. Exported here as well as from the package root, so a consumer that
// imports from `@zarel-ai/sdk/types` can name them instead of retyping them.
export type {
    ContractFlow,
    ContractFlowInput,
    ContractFlowStep,
    ContractFlowStepInline,
    ContractFlowOnCompletion,
    ContractFlowOnCompletionInline,
    ContractDeletedAck,
} from './flows-contract';

// The treatment family. Same reason as the block above.
export type {
    ContractTreatment,
    ContractTreatmentWrite,
    ContractTreatmentRails,
    ContractVocabularyEntry,
    ContractVocabularyCreate,
    ContractVocabularyWrite,
    ContractProfile,
    ContractProfileWrite,
    ContractProfileCreate,
    ContractTenantMetadata,
    ContractTenantMetadataWrite,
} from './treatment-contract';

// The four flat collections. Same reason again.
export type {
    CapabilityRecord,
    CapabilityCreate,
    CapabilityWrite,
    SchemaRecord,
    SchemaCreate,
    SchemaWrite,
    ConstraintRecord,
    ConstraintCreate,
    ConstraintWrite,
    PhaseRecord,
    PhaseCreate,
    PhaseWrite,
    PhaseEntryCondition,
    PhaseActionScope,
} from './collections-contract';

// `mcp-servers`, its nested `allowed-tools` and `events/rules`. Same reason again.
export type {
    McpRetryPolicy,
    McpServerRecord,
    McpServerCreate,
    McpServerWrite,
    McpAllowedToolRecord,
    McpAllowedToolCreate,
    McpAllowedToolWrite,
    WebhookEventEffect,
    FlowEventEffect,
    EventRuleEffect,
    EventRuleRecord,
    RecordCreatedRule,
    RecordUpdatedRule,
    RecordDeletedRule,
    StateTransitionedRule,
    SystemEventRule,
    EventRuleWrite,
    EventRulePatch,
} from './mcp-and-events-contract';

export type {
    ContractEntity,
    ContractEntityField,
    ContractEntityFieldList,
    ContractEntityFieldRecord,
    ContractEntityFieldRef,
    ContractEntityList,
    ContractEntityRecord,
    ContractEntitySummary,
    ContractFieldTransition,
    EntityInput,
    EntityReplaceInput,
    EntityWriteInput,
    FieldDefinitionInput,
    FieldReplaceInput,
    FieldWriteInput,
    ToolExecutionResult,
} from './entities';

export type {
    RoleAssignRequest,
    EventRecord,
    EventListResponse,
    EventSubscriptionInput,
    ErrorBody,
} from './platform';

export type {
    HealthResponse,
    MetricsResponse,
    ApiKeyCreateRequest,
    ApiKeyCreateResponse,
    ApiKeyListItem,
    ApiKeyListResponse,
    ApiKeyDeleteResponse,
} from './system';

export type {
    ImportExecutionMode,
    BulkImportItem,
    BulkImportRequest,
    BulkImportItemResult,
    BulkImportResponse,
    SnapshotImportFile,
    SnapshotImportRequest,
    SnapshotImportResponse,
} from './imports';

export type {
    Trace,
    TraceEvent,
    TraceEventError,
    TraceOutcome,
    TraceStage,
    TraceSummary,
    TraceUserRef,
    TraceListParams,
    TraceListResponse,
} from './traces';

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
    StrippedGrant,
    SpecDiffRequest,
    SpecApplyGating,
    SpecApplyRequest,
    SpecApplyResponse,
    SpecSnapshotV1Response,
    SpecDryRunStatus,
    SpecDryRunSubmitRequest,
    SpecDryRunSubmitResponse,
    SpecDryRunReport,
    SpecDryRunJob,
} from './contracts';

export type {
    ConversationSessionStatus,
    ConversationSessionSummary,
    ConversationTurnRecord,
    ConversationActionRecord,
    ConversationSessionDetail,
    ConversationSessionListParams,
    ConversationSessionListResponse,
    ConversationSessionDetailResponse,
    ConversationSessionActionsResponse,
} from './conversation-sessions';

export type {
    McpJsonRpcRequest,
    McpJsonRpcResponse,
    McpJsonRpcSuccess,
    McpJsonRpcError,
} from './mcp';
