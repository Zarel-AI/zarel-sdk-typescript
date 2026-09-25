// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// contract.assistant.* — ergonomic accessors over the contract authoring assistant.
//
// Maps the 5 `/contract/assistant/*` paths (contract plane) to typed methods.
// The transport unwraps the `{success,data}` envelope via the codegen unwrap
// map (operationIds assistantCreateSession/ConversationSend/GetChangeset/ApplyChangeset/
// DiscardChangeset). The conversation turn NEVER mutates; apply is the sole
// mutation entry point and carries `base_hash`.

import type { FetchClient } from '../_internal/fetch-client';

export interface CreateSessionInput {
    readonly llm_service?: string;
    readonly locale?: string;
}

export interface ConversationSendInput {
    readonly session_key: string;
    readonly message: string;
    readonly llm_service?: string;
    readonly locale?: string;
}

export interface ApplyGating {
    readonly reject_breaking_changes?: boolean;
    readonly max_changes?: number;
}

export interface ApplyChangesetInput {
    readonly base_hash: string;
    readonly gating?: ApplyGating;
    readonly force?: boolean;
}

export interface CreateSessionResult {
    readonly session_key: string;
}

export interface ConversationSendResult {
    readonly reply: string;
    readonly changeset_id?: string;
}

export type ChangesetStatus = 'pending' | 'applied' | 'discarded' | 'stale';

export interface ChangesetPreview {
    readonly id: string;
    readonly status: ChangesetStatus;
    readonly base_hash: string;
    readonly draft_yaml: string;
    /** Live-recomputed structural delta (`{changes[], impact_summary}`) or null when the draft can't be parsed. */
    readonly diff: unknown;
}

export interface ApplyResult {
    readonly applied: boolean;
    readonly applied_version: number;
    readonly diff: unknown;
    readonly stripped_grants: string[];
}

export interface DiscardResult {
    readonly discarded: boolean;
}

const BASE = '/contract/assistant';

export class AssistantResource {
    constructor(private readonly client: FetchClient) {}

    /** POST /contract/assistant/conversation/sessions — opens a contract-scope conversation. */
    async createSession(input: CreateSessionInput = {}): Promise<CreateSessionResult> {
        return await this.client.post(`${BASE}/conversation/sessions`, input, { operationId: 'assistantCreateSession' });
    }

    /** POST /contract/assistant/conversation/send — one turn. Stages but NEVER applies. */
    async conversationSend(input: ConversationSendInput): Promise<ConversationSendResult> {
        return await this.client.post(`${BASE}/conversation/send`, input, { operationId: 'assistantConversationSend' });
    }

    /** GET /contract/assistant/changesets/:id — live preview of the staged delta. */
    async getChangeset(id: string): Promise<ChangesetPreview> {
        return await this.client.get(`${BASE}/changesets/${encodeURIComponent(id)}`, undefined, { operationId: 'assistantGetChangeset' });
    }

    /**
     * POST /contract/assistant/changesets/:id/apply — the SOLE contract-mutation
     * entry point. `base_hash` is deliberate consent over a known base.
     * On staleness throws a `ZarelAPIError` whose `details` carries
     * `reseeded_changeset_id`/`base_hash`.
     */
    async applyChangeset(id: string, input: ApplyChangesetInput): Promise<ApplyResult> {
        return await this.client.post(`${BASE}/changesets/${encodeURIComponent(id)}/apply`, input, { operationId: 'assistantApplyChangeset' });
    }

    /** POST /contract/assistant/changesets/:id/discard — shelve a pending/stale changeset. */
    async discardChangeset(id: string): Promise<DiscardResult> {
        return await this.client.post(`${BASE}/changesets/${encodeURIComponent(id)}/discard`, {}, { operationId: 'assistantDiscardChangeset' });
    }
}
