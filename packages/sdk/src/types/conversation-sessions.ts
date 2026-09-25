// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// ═══════════════════════════════════════════════════════════════════════════
// Conversation session history types — derived from the runtime API's OpenAPI document
// ═══════════════════════════════════════════════════════════════════════════

export type ConversationSessionStatus = 'active' | 'expired' | 'cleared';

export interface ConversationSessionSummary {
    tenant_name: string;
    session_key: string;
    user_name: string;
    channel_name: string;
    status: ConversationSessionStatus;
    turn_count: number;
    created_at: string;
    last_activity: string;
}

export interface ConversationTurnRecord {
    turn_number: number;
    role: 'user' | 'assistant' | 'system';
    content: string;
    intent_id?: string;
    intent_type?: string;
    metadata?: Record<string, unknown>;
    created_at: string;
}

export interface ConversationActionRecord {
    id: string;
    session_key: string;
    turn_number: number;
    action_type: string;
    entity_name: string;
    record_id: string;
    action_data?: Record<string, unknown>;
    changed_fields?: string[];
    actor?: string;
    created_at: string;
}

export interface ConversationSessionDetail {
    session: ConversationSessionSummary & {
        /**
         * Session-level snapshot of the actor's roles. NOT
         * a security gate — exposed for observability / UI display only.
         */
        roles_snapshot: string[];
        metadata: Record<string, unknown>;
        current_phase?: string;
        updated_at: string;
    };
    turns: ConversationTurnRecord[];
    actions: ConversationActionRecord[];
}

export interface ConversationSessionListParams {
    channel_name?: string;
    status?: ConversationSessionStatus;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
}

export type ConversationSessionListResponse = ConversationSessionSummary[];

export type ConversationSessionDetailResponse = ConversationSessionDetail;

export type ConversationSessionActionsResponse = ConversationActionRecord[];
