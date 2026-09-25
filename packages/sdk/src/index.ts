// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// ── Main client ─────────────────────────────────────────────────────────
export { Zarel } from './client';
export type { ZarelOptions } from './client';

// ── Plane namespaces (for advanced consumer typing) ─────────────────────
export { RuntimeNamespace } from './runtime';
export { ContractNamespace } from './contract';
export { ContractAgentRoots } from './contract/roots';

// ── Errors ──────────────────────────────────────────────────────────────
export { ZarelError, ZarelAPIError, ZarelAuthError, ZarelTimeoutError } from './errors';
export type { ZarelAuthErrorCode } from './errors';

// ── Locale ──────────────────────────────────────────────────────────────
export type { LocaleOptions, SdkLocale } from './types/locale';

// ── Types ───────────────────────────────────────────────────────────────
export type {
    ConversationRequest,
    ConversationResponse,
    ConversationTurn,
    InteractionContext,
    ConversationDebugInfo,
} from './types/conversation';
// Channel-ops DTOs + resource.
export { ChannelsResource } from './resources/channels';
export type {
    MintPartyTokenRequest,
    PartyToken,
    ChannelDirectiveContent,
    ChannelSendResult,
    ChannelDirectiveStreamEvent,
} from './types/channels';

export type {
    ActionDispatchParams,
    ActionDispatchSuccessResponse,
} from './types/actions';

// The confirmation round-trip (`ZarelAPIError.confirmation`).
export type {
    ConfirmationGuard,
    ConfirmationChallenge,
    ConfirmationRetryOptions,
} from './types/confirmation';

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
    UserVisibleRole,
    UserVisibleFlow,
    UserVisibleSkill,
    ContractSectionName,
    FieldToolDefinition,
    McpToolDefinition,
} from './types/tools';

export { CONTRACT_SECTION_NAMES } from './types/tools';

export type {
    WorkflowReplayRequest,
    WorkflowReplayResponse,
    WorkflowReplayResult,
    WorkflowReplayEmptyResult,
    WorkflowReplayEventResult,
    WorkflowStateMachineConfig,
    WorkflowTransitionConfig,
    WorkflowTransitionRule,
} from './types/workflows';

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
} from './types/state-machine';

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
} from './types/flows';

export type {
    RecordData,
    RefLabel,
    RecordListParams,
    RecordListResponse,
    RecordResponse,
    FilterOp,
    FilterExpr,
    FilterValue,
    SortDir,
    SortSpec,
} from './types/records';

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
} from './types/entities';

// The published field-type vocabulary, exported so a consumer can name a field type without
// restating the union.
export type { ContractFieldTypeName } from './generated';

export type {
    ContractFlow,
    ContractFlowInput,
    ContractFlowStep,
    ContractFlowStepInline,
    ContractFlowStepCreate,
    ContractFlowStepWrite,
    ContractFlowOnCompletion,
    ContractFlowOnCompletionInline,
    ContractFlowOnCompletionCreate,
    ContractFlowOnCompletionWrite,
    ContractDeletedAck,
} from './types/flows-contract';

export type { AuthorizationGrant, AuthorizationGrantCreate, AuthorizationQualifiers, AuthorizationStatement, RoleAuthorization } from './resources/authorization';
export { grantQualifiers } from './resources/authorization';
export type { OwnerCeilingEnvelope, EnvelopeGrant, EnvelopeGrantKind } from './resources/authorization-ceiling';
export type { RoleRecord, RoleCreateInput, RoleUpdatePatch } from './resources/roles';

// ── Typed SSE event stream (client.runtime.events.stream) ───────────────────
export type {
    RuntimeStreamEvent,
    ConversationTurnCreatedEvent,
    ConversationTurnCreatedData,
    ConversationTurnCreatedPayload,
    GenericStreamEvent,
    EventStreamHandle,
    EventStreamHandlers,
    EventStreamOptions,
    EventIterateOptions,
} from './types/events-stream';
export { isConversationTurnCreatedEvent } from './types/events-stream';

// ── MCP JSON-RPC transport (client.runtime.mcp.call) ────────────────────────
export type {
    McpJsonRpcRequest,
    McpJsonRpcResponse,
    McpJsonRpcSuccess,
    McpJsonRpcError,
} from './types/mcp';

export type {
    RoleAssignRequest,
    EventRecord,
    EventListResponse,
    EventSubscriptionInput,
    EventSubscription,
    EventSubscriptionResponse,
    EventSubscriptionListResponse,
    EventSubscriptionDeactivateResponse,
    ErrorBody,
} from './types/platform';

export type {
    HealthResponse,
    MetricsResponse,
    ApiKeyCreateRequest,
    ApiKeyCreateResponse,
    ApiKeyListItem,
    ApiKeyListResponse,
    ApiKeyDeleteResponse,
} from './types/system';

export type {
    ImportExecutionMode,
    BulkImportItem,
    BulkImportRequest,
    BulkImportItemResult,
    BulkImportResponse,
    SnapshotImportFile,
    SnapshotImportRequest,
    SnapshotImportResponse,
} from './types/imports';

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
} from './types/conversation-sessions';

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
} from './types/traces';

export type {
    AuditRowLogName,
    BindingViolationAuditRow,
    TopicRefusalAuditRow,
    AuditListParamsBase,
    BindingViolationAuditListParams,
    TopicRefusalAuditListParams,
    AuditListResponse,
} from './types/audit';

// The evidence half of `audit`. `AuditRowLogName` above names the
// privacy-preserving ROW-TABLES; these name the event HASH-CHAINS. The two share
// a URL prefix and nothing else. Exporting these lets a consumer that offers the
// evidence download spell its argument instead of re-declaring the union locally.
export type { AuditLogName, AuditEvidenceRange } from './resources/audit';

export type {
    Receipt,
    ReceiptSignal,
    ReceiptProof,
    RefusalReceipt,
    BindingReceipt,
    ValidationReceipt,
    ReceiptListParams,
    ReceiptListResponse,
} from './types/receipt';

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
    SpecDryRunOutcome,
    SpecDryRunUnknownCause,
    SpecDryRunReplayWindow,
    SpecDryRunFilter,
    SpecDryRunSubmitRequest,
    SpecDryRunSubmitResponse,
    SpecDryRunChangeBreakdown,
    SpecDryRunUnknown,
    SpecDryRunAffectedUser,
    SpecDryRunOperationalImplications,
    SpecDryRunReport,
    SpecDryRunJobProgress,
    SpecDryRunJobFailure,
    SpecDryRunJob,
} from './types/contracts';

// ── Internal types (for advanced composition / custom fetch clients) ───────
export type { FetchClientOptions, TokenInput } from './_internal/fetch-client';

// ── Request/response/error interceptors ────────────────────────────────────
export type {
    Interceptors,
    RequestInterceptorContext,
    ResponseInterceptorContext,
    ErrorInterceptorContext,
} from './_internal/interceptors';
