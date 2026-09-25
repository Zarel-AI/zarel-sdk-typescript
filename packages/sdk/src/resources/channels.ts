// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
import { type FetchClient } from '../_internal/fetch-client';
import type { EventStreamHandle, EventStreamOptions } from '../types/events-stream';
import type {
    MintPartyTokenRequest,
    PartyToken,
    ChannelDirectiveContent,
    ChannelSendResult,
    ChannelDirectiveStreamEvent,
} from '../types/channels';

/**
 * The four channel operations the channel-ingress credential grants:
 * mint / subscribe / fetch(=claim) / report. The client MUST be configured with a
 * `channel`-class credential as its runtime token; these are the ONLY routes that
 * accept it (asymmetric acceptance). This is the closed SDK duplex surface
 * a channel gateway uses.
 */
export class ChannelsResource {
    constructor(private readonly client: FetchClient) {}

    /** Mint a short-TTL anonymous party token bound to (credential channel, party_ref). */
    async mint(request: MintPartyTokenRequest): Promise<PartyToken> {
        return await this.client.post<PartyToken>('/runtime/channels/mint', request, { operationId: 'runtimeChannelsMint' });
    }

    /**
     * fetch(=claim): take the delivery lease AND read the reply body. The lease is keyed
     * by the credential; re-fetch by the holder refreshes it, a foreign live lease is 409.
     */
    async fetch(directiveId: string): Promise<ChannelDirectiveContent> {
        return await this.client.get<ChannelDirectiveContent>(
            `/runtime/channels/directives/${encodeURIComponent(directiveId)}/content`,
            undefined,
            { operationId: 'runtimeChannelsFetch' },
        );
    }

    /** report(=ack): terminal send-result + lease release. */
    async report(directiveId: string, result: ChannelSendResult): Promise<{ status: string }> {
        return await this.client.post<{ status: string }>(
            `/runtime/channels/directives/${encodeURIComponent(directiveId)}/send-result`,
            result,
            { operationId: 'runtimeChannelsReport' },
        );
    }

    /**
     * subscribe: open the SSE stream of new directives for the credential's own channel
     * (server-side filtered). `onDirective` fires per `channel.directive_created`
     * frame with the directive id to fetch. Returns a teardown handle. Uses the SDK's
     * dep-free reconnecting SSE client — no runtime deps added.
     */
    subscribe(
        onDirective: (event: ChannelDirectiveStreamEvent) => void,
        options: EventStreamOptions & { onError?: (err: unknown) => void; onOpen?: () => void } = {},
    ): EventStreamHandle {
        return this.client.openEventStream(
            '/runtime/channels/directives/stream',
            {
                onEvent: (event) => {
                    if (event.event !== 'channel.directive_created') return;
                    let data: { directive_id?: unknown } | undefined;
                    try {
                        data = typeof event.data === 'string'
                            ? JSON.parse(event.data) as { directive_id?: unknown }
                            : (event.data as { directive_id?: unknown } | undefined);
                    } catch {
                        return; // malformed frame — drop, never throw into onEvent
                    }
                    if (data && typeof data.directive_id === 'string') {
                        onDirective({ directive_id: data.directive_id });
                    }
                },
                ...(options.onError ? { onError: options.onError } : {}),
                ...(options.onOpen ? { onOpen: options.onOpen } : {}),
            },
            options,
        );
    }
}
