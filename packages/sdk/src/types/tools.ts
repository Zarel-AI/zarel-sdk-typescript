// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// ── Tools ────────────────────────────────────────────────────────────────

export interface UserVisibleAction {
    action: 'create' | 'read' | 'list' | 'update' | 'delete';
    owned_only: boolean;
}

export interface FieldToolDefinition {
    name: string;
    type: string;
    required: boolean;
    label?: string;
    description?: string;
    config?: Record<string, unknown>;
    options?: string[];
    /**
     * Enum value → localized display label, resolved from the field's i18n
     * sidecar at projection time. Present only for enum fields; options with no
     * authored label are omitted, so consumers MUST fall back to the raw
     * `options` code when a key is absent. (Mirror of the contract-side
     * `FieldToolDefinition` — kept in lockstep.)
     */
    values?: Record<string, string>;
    default?: unknown;
    references?: string;
    /**
     * The effective display field of the *referenced* entity for a
     * reference/reference[] field — the field a client labels/searches the target
     * by. Resolved server-side; omitted when unresolvable.
     * (Mirror of the contract-side `FieldToolDefinition` — kept in lockstep.)
     */
    display_field?: string;
    constraints?: Record<string, unknown>;
    compute?: {
        expression?: string;
        strategy?: 'write' | 'read';
        cache?: boolean;
    };
    // Parameter binding — signals the field's value is server-authoritative
    // (`bind`) or rule-constrained (`assert` / `immutable_after_set`).
    binding?:
        | { bind: string }
        | { assert: string }
        | { immutable_after_set: true };
}

export interface UserVisibleEntityTool {
    entity_name: string;
    entity_label: string;
    description?: string;
    actions: UserVisibleAction[];
    fields: FieldToolDefinition[];
    tool_names: string[];
}

/**
 * Per-edge projection of a `StateMachineTransition` exposed to UIs through
 * the catalog. `requires_reason` is omitted when the
 * underlying flag is `false` or absent.
 */
export interface TransitionEdge {
    from: string;
    to: string;
    requires_reason?: boolean;
}

/**
 * Per-user projection of a state-machine `(entity, field)` transition tool
 * trio. Carries the rendering inputs needed by the UI surfaces
 * (`<FieldTransitions>`, `<TransitionRequestQueue>`).
 */
export interface UserVisibleTransitionTool {
    entity_name: string;
    field_name: string;
    request_tool_name: string;
    resolve_tool_name: string;
    list_pending_tool_name: string;
    target_states: readonly string[];
    transitions: readonly TransitionEdge[];
    field_label?: string;
    field_description?: string;
    inspect: boolean;
}

/**
 * Per-user projection of a YAML-declared `action` the user is
 * authorized to dispatch. Carries the rendering inputs needed by the UI
 * surfaces (`<EntityActions>`, `<EntityRecordActions>`).
 *
 * ONE ENTRY IN EITHER `actions[]` OR `dispatchable_actions[]` — the element type is shared and
 * the RULE is not: `actions[]` is exposed AND granted, `dispatchable_actions[]` is granted.
 */
export interface UserVisibleActionTool {
    /** Action name from YAML — unique within the tenant. */
    name: string;
    /** Underlying entity the action operates on. */
    entity: string;
    /** CRUD verb the action invokes server-side. */
    verb: 'create' | 'read' | 'update' | 'delete' | 'list';
    /** Human-readable description (from YAML `action.description`). */
    description?: string;
    /** Dispatcher-recognised intent string — `action.<name>` or `external.<ns>.<tool>`. */
    intent_type: string;
    /** Whether the action is native (declared in tenant YAML) or external. */
    provenance: 'native' | 'external';
}

/**
 * Per-tenant role declaration. Always projected for every caller — read-only
 * metadata used by UIs to render role pickers and label other catalog
 * references. Editing is gated separately by the `roles` contract-section
 * policy (surfaced to UIs via {@link UserToolCatalog.admin_sections}).
 */
export interface UserVisibleRole {
    name: string;
    label?: string;
    description?: string;
}

/**
 * Per-tenant flow declaration projected for users with `inspect` policy on the
 * flow (open by default). Only carries what a navigation list needs — the
 * full editable shape is fetched from the contract API.
 */
export interface UserVisibleFlow {
    name: string;
    description?: string;
}

/**
 * Per-tenant skill declaration projected for users whose role set satisfies
 * the skill's YAML `constraints[]`.
 */
export interface UserVisibleSkill {
    name: string;
    label?: string;
    description?: string;
}

/**
 * Mirror of `@zarel-ai/contract`'s `CONTRACT_SECTION_NAMES`. The closed set
 * of contract sections; `UserToolCatalog.admin_sections` is a subset (the
 * sections the user can `update`). The SDK has no dependencies and does not
 * import the contract package, so this is a hand-maintained mirror: keep it
 * equal to the contract package's list.
 */
export const CONTRACT_SECTION_NAMES = [
    'metadata', 'entities', 'roles', 'skills', 'actions', 'schemas',
    'capabilities', 'flows', 'constraints', 'events',
    'llm', 'embeddings', 'treatment',
    'channels', 'channels/credentials',
    'mcp_servers', 'quotas', 'timezone',
    'process_model', 'authorization',
] as const;

export type ContractSectionName = typeof CONTRACT_SECTION_NAMES[number];

export interface UserToolCatalog {
    tenant_name: string;
    user_name: string;
    user_roles: string[];
    entities: UserVisibleEntityTool[];
    /** Trio-coupled state-machine projection. */
    transitions?: UserVisibleTransitionTool[];
    /**
     * THE TOOL SURFACE — every EXPOSED action, exactly the actions offered as MCP tools.
     */
    actions?: UserVisibleActionTool[];
    /**
     * EVERY GRANTED action, exposure irrelevant — what may be DISPATCHED by name through
     * `POST /runtime/actions/:name`.
     *
     * A UI offering action buttons reads THIS one, not `actions`. An unexposed action has no MCP
     * tool and is still dispatchable, and the bare `/runtime/records` surface answers
     * `action_required` for a verb that carries a named action — so a button missing here leaves
     * the verb with no path at all.
     */
    dispatchable_actions?: UserVisibleActionTool[];
    /** Declared roles in the tenant contract (read-only metadata). */
    roles: UserVisibleRole[];
    /** Flows the user can `inspect` (open by default). */
    flows: UserVisibleFlow[];
    /** Skills whose YAML `constraints` evaluate true for the user. */
    skills: UserVisibleSkill[];
    /**
     * Contract sections the user can `update`. A UI can derive which admin
     * **mutation** pages to offer (roles, skills, flows, authorization,
     * state machines, settings) and the admin-tier pages (imports, API keys)
     * from this.
     */
    admin_sections: ContractSectionName[];
}

export interface ToolCatalogResponse {
    success: true;
    catalog: UserToolCatalog;
}

export interface McpToolDefinition {
    name: string;
    title?: string;
    description?: string;
    inputSchema?: Record<string, unknown>;
}

export interface McpToolsResponse {
    success: true;
    tools: McpToolDefinition[];
}

export interface ToolCallRequest {
    tool: string;
    parameters: Record<string, unknown>;
}

export interface ToolCallResponse {
    success: boolean;
    result?: unknown;
}
