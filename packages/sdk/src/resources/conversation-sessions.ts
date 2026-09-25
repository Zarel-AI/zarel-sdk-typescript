// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
/**
 * Conversation-session creation resource.
 *
 * Backs `POST /runtime/conversation/sessions`. Sessions are created explicitly —
 * `client.conversation.send` does not lazily create them.
 */

import type { FetchClient } from '../_internal/fetch-client';
import type { ConversationSessionCreateBodyPayload } from '../generated';

/**
 * DERIVED from the published create body, so a scope added to the surface arrives here with
 * it.
 */
export type ConversationScope = ConversationSessionCreateBodyPayload['scope'];

export interface ConversationSessionCreateInput {
    channel_name: string;
    /**
     * Session-level snapshot of the actor's roles. NOT a
     * security gate — the server authorizes against the actor's assigned
     * roles, not this snapshot. The snapshot only shapes the actor context
     * the language model is given.
     */
    rolesSnapshot: string[];
    scope: ConversationScope;
    /** Optional pin — the session will use this service unless overridden per-turn. */
    llmService?: string;
    userName?: string;
    metadata?: Record<string, unknown>;
}

export interface ConversationSessionResponse {
    session_key: string;
    user_name: string;
    channel_name: string;
    /**
     * Session-level snapshot of the actor's roles. NOT a
     * security gate — exposed for observability / UI display only.
     */
    roles_snapshot: string[];
    scope: ConversationScope;
    llm_service_name: string | null;
    status: string;
    turn_count: number;
    created_at: string;
    updated_at: string;
    last_activity: string;
}

/** @deprecated The transport unwraps the envelope — methods return the
 * bare `ConversationSessionResponse`. Kept as an alias for the exported name. */
export type ConversationSessionEnvelope = ConversationSessionResponse;

/**
 * `POST /runtime/conversation/sessions` only.
 *
 * To read a session with its turns use `ConversationResource.session()`
 * (`ConversationSessionDetailResponse`); to clear one use
 * `ConversationResource.deleteSession()`.
 */
export class ConversationSessionsResource {
    constructor(private readonly client: FetchClient) {}

    async create(input: ConversationSessionCreateInput): Promise<ConversationSessionResponse> {
        // No `session_key`: the SERVER mints it and REFUSES a body that carries one
        // (a client-chosen key would be guessable, squattable, and an existence
        // oracle). Read the minted key off the response.
        // TYPED AGAINST THE PUBLISHED BODY, not `Record<string, unknown>`. This method's whole
        // job is to rename six camelCase inputs onto the wire's snake_case, so a typo'd wire key
        // is refused by the compiler here as well as by the route.
        const body: ConversationSessionCreateBodyPayload = {
            channel_name: input.channel_name,
            roles_snapshot: input.rolesSnapshot,
            scope: input.scope,
            ...(input.llmService !== undefined ? { llm_service: input.llmService } : {}),
            ...(input.userName !== undefined ? { user_name: input.userName } : {}),
            ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
        };
        return await this.client.post<ConversationSessionResponse>('/runtime/conversation/sessions', body, { operationId: 'createConversationSession' });
    }
}
