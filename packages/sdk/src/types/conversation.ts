// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
import type { operations } from '../generated/runtime';
import type { ConversationSendBodyPayload } from '../generated';
// ═══════════════════════════════════════════════════════════════════════════
// Conversation / conversation types — derived from the runtime API's OpenAPI document
// ═══════════════════════════════════════════════════════════════════════════

// ── Conversation ────────────────────────────────────────────────────────────────

// Derived from the generated OpenAPI types — the canonical transport enum;
// never a literal copy.
export type Channel = NonNullable<NonNullable<operations['listConversationSessions']['parameters']['query']>['channel_name']>;

/**
 * THE TURN BODY, DERIVED from the runtime API's OpenAPI document, so there is one description
 * of it.
 *
 * `session_key` is REQUIRED: the route does not create a session lazily, and answers 400
 * without one. There is no `role` key.
 */
export type ConversationRequest = ConversationSendBodyPayload;

/** The per-turn treatment overrides, as the published body declares them. */
export type InteractionContext = NonNullable<ConversationRequest['interaction']>;

// There is deliberately no `IntentType` union: no finite list can be correct, because two of the
// canonical intent families are parametric over the entity and action names each tenant chooses.
// `intent_type` is a `string`, as the runtime API's OpenAPI document declares it.

export interface ConversationDebugInfo {
    enabled?: boolean;
    system_prompt?: string;
    llm_raw_response?: unknown;
    errors?: Array<{
        source?: string;
        message?: string;
        metadata?: Record<string, unknown>;
    }>;
    flow?: Record<string, unknown>;
    interaction?: {
        channel_name?: string;
        audience?: string;
        modality?: string;
        renderer_name?: string;
        output_type?: string;
    };
}

export interface ConversationResponse {
    success: boolean;
    message: string;
    intent_type?: string;
    intent_id?: string;
    data?: unknown;
    clarification_needed?: boolean;
    options?: string[];
    suggestions?: string[];
    error?: string;
    /** The turn's correlation id, to tie it to its receipts. */
    trace_id?: string;
    /** The inbound turn's sequence number (present on channel party turns). */
    conversation_turn_seq?: number;
    _debug?: ConversationDebugInfo;
}

export interface ConversationTurn {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: string;
    intent_id?: string;
    metadata?: {
        intent_type?: string;
        entity_name?: string;
        data?: Record<string, unknown>;
        interaction_context?: {
            channel_name?: string;
            audience?: string;
            modality?: string;
            renderer_name?: string;
        };
    };
}

export interface ConversationHistoryResponse {
    success: true;
    history: ConversationTurn[];
}

