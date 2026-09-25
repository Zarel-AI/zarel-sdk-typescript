// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
import { ConversationResource } from '../src/resources/conversation';
import type { FetchClient } from '../src/_internal/fetch-client';

function createMockClient() {
    return {
        get: jest.fn(async (_path: string) => ({ success: true, data: [] })),
        post: jest.fn(async (_path: string, _body?: unknown) => ({ success: true })),
        put: jest.fn(async (_path: string, _body?: unknown) => ({ success: true })),
        del: jest.fn(async (_path: string) => ({ success: true })),
    };
}

describe('ConversationResource — session history', () => {
    describe('sessions()', () => {
        it('calls GET /runtime/conversation/sessions with no params', async () => {
            const client = createMockClient();
            const resource = new ConversationResource(client as unknown as FetchClient);

            await resource.sessions();

            expect(client.get).toHaveBeenCalledWith('/runtime/conversation/sessions', undefined, { operationId: 'listConversationSessions' });
        });

        it('appends query params when provided', async () => {
            const client = createMockClient();
            const resource = new ConversationResource(client as unknown as FetchClient);

            await resource.sessions({ channel_name: 'api', status: 'active', limit: 10 });

            const calledUrl = client.get.mock.calls[0][0];
            expect(calledUrl).toContain('/runtime/conversation/sessions?');
            expect(calledUrl).toContain('channel_name=api');
            expect(calledUrl).toContain('status=active');
            expect(calledUrl).toContain('limit=10');
        });

        it('includes from/to date filters', async () => {
            const client = createMockClient();
            const resource = new ConversationResource(client as unknown as FetchClient);

            await resource.sessions({ from: '2026-01-01', to: '2026-01-31' });

            const calledUrl = client.get.mock.calls[0][0];
            expect(calledUrl).toContain('from=2026-01-01');
            expect(calledUrl).toContain('to=2026-01-31');
        });
    });

    describe('session()', () => {
        it('calls GET /runtime/conversation/sessions/:session_key', async () => {
            const client = createMockClient();
            const resource = new ConversationResource(client as unknown as FetchClient);

            await resource.session('acme:alice:api');

            expect(client.get).toHaveBeenCalledWith(
                '/runtime/conversation/sessions/acme%3Aalice%3Aapi',
                undefined,
                { operationId: 'getConversationSession' },
            );
        });
    });

    describe('actions()', () => {
        it('calls GET /runtime/conversation/sessions/:session_key/actions', async () => {
            const client = createMockClient();
            const resource = new ConversationResource(client as unknown as FetchClient);

            await resource.actions('acme:alice:api');

            expect(client.get).toHaveBeenCalledWith(
                '/runtime/conversation/sessions/acme%3Aalice%3Aapi/actions',
                undefined,
                { operationId: 'listConversationActions' },
            );
        });
    });
});
