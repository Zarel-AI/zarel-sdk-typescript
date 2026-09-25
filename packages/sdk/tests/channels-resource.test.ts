// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
import { describe, it, expect, jest } from '@jest/globals';
import type { FetchClient } from '../src/_internal/fetch-client';
import { ChannelsResource } from '../src/resources/channels';

function mockClient(over: Record<string, unknown> = {}) {
    return {
        post: jest.fn(async (_path: string, _body?: unknown) => ({ token: 't', expires_at: 'x' })),
        get: jest.fn(async (_path: string) => ({ id: 'd1', content: 'body' })),
        openEventStream: jest.fn((_path: string, _handlers: unknown) => ({ close: jest.fn() })),
        ...over,
    } as unknown as FetchClient;
}

describe('ChannelsResource (the four ops)', () => {
    it('mint POSTs { party_ref } to /runtime/channels/mint', async () => {
        const post = jest.fn(async () => ({ token: 'tok', expires_at: '2026-01-01' }));
        const r = new ChannelsResource(mockClient({ post }));
        const out = await r.mint({ party_ref: 'a'.repeat(64) });
        expect(post).toHaveBeenCalledWith('/runtime/channels/mint', { party_ref: 'a'.repeat(64) }, { operationId: 'runtimeChannelsMint' });
        expect(out).toEqual({ token: 'tok', expires_at: '2026-01-01' });
    });

    it('fetch GETs the directive content (URL-encoded id)', async () => {
        const get = jest.fn(async () => ({ id: 'd/1', content: 'hola' }));
        const r = new ChannelsResource(mockClient({ get }));
        await r.fetch('d/1');
        expect(get).toHaveBeenCalledWith('/runtime/channels/directives/d%2F1/content', undefined, { operationId: 'runtimeChannelsFetch' });
    });

    it('report POSTs the send-result', async () => {
        const post = jest.fn(async () => ({ status: 'sent' }));
        const r = new ChannelsResource(mockClient({ post }));
        await r.report('d1', { status: 'accepted', provider_message_id: 'wamid.x', attested_by: 'channel_provider' });
        expect(post).toHaveBeenCalledWith(
            '/runtime/channels/directives/d1/send-result',
            { status: 'accepted', provider_message_id: 'wamid.x', attested_by: 'channel_provider' },
            { operationId: 'runtimeChannelsReport' },
        );
    });

    it('subscribe opens the SSE stream and fires onDirective only for channel.directive_created frames', () => {
        let captured: { onEvent: (e: unknown) => void } | undefined;
        const openEventStream = jest.fn((_path: string, handlers: { onEvent: (e: unknown) => void }) => {
            captured = handlers;
            return { close: jest.fn() };
        });
        const r = new ChannelsResource(mockClient({ openEventStream }));
        const seen: string[] = [];
        r.subscribe((e) => seen.push(e.directive_id));

        expect(openEventStream).toHaveBeenCalledWith('/runtime/channels/directives/stream', expect.anything(), expect.anything());
        captured!.onEvent({ event: 'conversation.turn_created', data: { directive_id: 'IGNORED' } }); // wrong event → ignored
        captured!.onEvent({ event: 'channel.directive_created', data: { directive_id: 'd1' } });
        captured!.onEvent({ event: 'channel.directive_created', data: '{"directive_id":"d2"}' }); // string data tolerated
        expect(seen).toEqual(['d1', 'd2']);
    });
});
