// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
import { type FetchClient, localeQueryOrUndefined } from '../_internal/fetch-client';
import { PagePromise, bareArrayOffset, type PageParams } from '../_internal/pagination';
import type {
    ConversationRequest,
    ConversationResponse,
} from '../types/conversation';
import type {
    ConversationSessionListParams,
    ConversationSessionListResponse,
    ConversationSessionDetailResponse,
    ConversationSessionActionsResponse,
    ConversationSessionSummary,
} from '../types/conversation-sessions';
import type { LocaleOptions } from '../types/locale';

function appendLocale(path: string, options?: LocaleOptions): string {
    if (!options?.locale) return path;
    const sep = path.includes('?') ? '&' : '?';
    return `${path}${sep}locale=${encodeURIComponent(options.locale)}`;
}

export class ConversationResource {
    constructor(private readonly client: FetchClient) {}

    /**
     * Send a natural language message to the cognitive agent.
     *
     * Pass `{locale: 'es'}` to override the actor's
     * `preferences.language` JWT claim for *this turn only*. Useful for
     * preview/testing and for actors whose stored preference does not
     * match their current need. Omit for canonical server-side resolution
     * (JWT preferences.language → canonical).
     */
    async send(request: ConversationRequest, options?: LocaleOptions): Promise<ConversationResponse> {
        // POST /runtime/conversation/send returns the flat ConversationResponse body directly
        // (no {success,data} envelope). Opt out of the
        // transport envelope-unwrap: a reply with only envelope-shaped keys
        // (e.g. {success, message}) would otherwise be misread as an envelope.
        return await this.client.post<ConversationResponse>(appendLocale('/runtime/conversation/send', options), request, { operationId: 'runtimeConversationSend' });
    }

    /**
     * Soft-delete a conversation session: its status becomes `cleared` and its
     * history is kept for audit.
     */
    async deleteSession(sessionKey: string): Promise<void> {
        await this.client.del(
            `/runtime/conversation/sessions/${encodeURIComponent(sessionKey)}`,
            { operationId: 'clearConversationSession' },
        );
    }

    /**
     * List past conversation sessions for the authenticated user.
     *
     * Returns a {@link PagePromise}: `await` it for the first page
     * (`ConversationSessionSummary[]` — unchanged), or `for await (… of …)` to
     * auto-paginate over every session. This endpoint has no `total`/cursor in
     * its wire shape, so iteration advances by page size and stops when a page
     * returns fewer items than the page size; when the session count is an exact
     * multiple of the page size, one extra request returns an empty page and
     * iteration then stops (no items missed or duplicated). Pass `{ signal }`
     * to cancel an in-flight page; `break` also stops further fetches.
     */
    sessions(
        params?: ConversationSessionListParams,
        options?: LocaleOptions & { signal?: AbortSignal },
    ): PagePromise<ConversationSessionListResponse, ConversationSessionSummary> {
        const buildPath = (offset?: number, limit?: number): string => {
            const query = new URLSearchParams();
            if (params?.channel_name) query.set('channel_name', params.channel_name);
            if (params?.status) query.set('status', params.status);
            if (params?.from) query.set('from', params.from);
            if (params?.to) query.set('to', params.to);
            if (limit !== undefined) query.set('limit', String(limit));
            if (offset !== undefined) query.set('offset', String(offset));
            if (options?.locale) query.set('locale', options.locale);

            const qs = query.toString();
            return qs ? `/runtime/conversation/sessions?${qs}` : '/runtime/conversation/sessions';
        };

        const signal = options?.signal;
        const fetchPage = (p: PageParams): Promise<ConversationSessionListResponse> => {
            const path = buildPath(p.offset, p.limit);
            return this.client.get<ConversationSessionListResponse>(path, undefined, { operationId: 'listConversationSessions', ...(signal ? { signal } : {}) });
        };

        return new PagePromise(
            fetchPage,
            bareArrayOffset<ConversationSessionSummary>(),
            {
                ...(params?.limit !== undefined ? { limit: params.limit } : {}),
                ...(params?.offset !== undefined ? { offset: params.offset } : {}),
            },
        );
    }

    /**
     * Get a conversation session with its full turn history.
     */
    async session(sessionKey: string, options?: LocaleOptions): Promise<ConversationSessionDetailResponse> {
        const path = `/runtime/conversation/sessions/${encodeURIComponent(sessionKey)}`;
        const q = localeQueryOrUndefined(options);
        return q
            ? await this.client.get<ConversationSessionDetailResponse>(path, q, { operationId: 'getConversationSession' })
            : await this.client.get<ConversationSessionDetailResponse>(path, undefined, { operationId: 'getConversationSession' });
    }

    /**
     * Get actions (record mutations) linked to a conversation session.
     */
    async actions(sessionKey: string, options?: LocaleOptions): Promise<ConversationSessionActionsResponse> {
        const path = `/runtime/conversation/sessions/${encodeURIComponent(sessionKey)}/actions`;
        const q = localeQueryOrUndefined(options);
        return q
            ? await this.client.get<ConversationSessionActionsResponse>(path, q, { operationId: 'listConversationActions' })
            : await this.client.get<ConversationSessionActionsResponse>(path, undefined, { operationId: 'listConversationActions' });
    }
}
