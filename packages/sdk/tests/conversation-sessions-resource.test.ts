// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
import { ConversationSessionsResource } from '../src/resources/conversation-sessions';
import { FlowsResource } from '../src/resources/flows';
import type { FetchClient } from '../src/_internal/fetch-client';

function createMockClient() {
    return {
        get: jest.fn(async (_path: string, _query?: unknown, _opts?: unknown) => ({ success: true, data: [] })),
        post: jest.fn(async (_path: string, _body?: unknown, _opts?: unknown) => ({ success: true, data: {} })),
        put: jest.fn(async (_path: string, _body?: unknown, _opts?: unknown) => ({ success: true })),
        patch: jest.fn(async (_path: string, _body?: unknown, _opts?: unknown) => ({ success: true })),
        del: jest.fn(async (_path: string, _opts?: unknown) => ({ success: true })),
    };
}

/**
 * The BODY is what the server judges, so the body is what these assert.
 *
 * `POST /runtime/conversation/sessions` mints the key itself and answers 400
 * (`session_key is assigned by the server; do not send one`) to any body carrying one.
 *
 * A test that asserts on the argument handed to a STUBBED `sessions.create` — one level
 * above the wire — stays green if `body.session_key` is sent again. The assertion that
 * discriminates is the one on the request body, which is here.
 */
describe('ConversationSessionsResource.create — the server mints the key', () => {
    it('sends NO session_key in the request body', async () => {
        const client = createMockClient();
        const resource = new ConversationSessionsResource(client as unknown as FetchClient);

        await resource.create({ channel_name: 'dashboard', rolesSnapshot: [], scope: 'runtime' });

        expect(client.post).toHaveBeenCalledTimes(1);
        const [path, body] = client.post.mock.calls[0]!;
        expect(path).toBe('/runtime/conversation/sessions');
        expect(body).not.toHaveProperty('session_key');
        expect(body).not.toHaveProperty('sessionKey');
    });

    it('sends the fields the route does require', async () => {
        const client = createMockClient();
        const resource = new ConversationSessionsResource(client as unknown as FetchClient);

        await resource.create({ channel_name: 'desk', rolesSnapshot: ['admin'], scope: 'contract' });

        expect(client.post.mock.calls[0]![1]).toEqual({
            channel_name: 'desk',
            roles_snapshot: ['admin'],
            scope: 'contract',
        });
    });

    it('omits the optional keys entirely rather than sending undefined', async () => {
        // `llm_service: undefined` is not the same as an absent key, although a JSON
        // body drops undefined values anyway — asserting absence keeps the two readings
        // from diverging.
        const client = createMockClient();
        const resource = new ConversationSessionsResource(client as unknown as FetchClient);

        await resource.create({ channel_name: 'api', rolesSnapshot: [], scope: 'runtime' });

        const body = client.post.mock.calls[0]![1] as Record<string, unknown>;
        expect(Object.keys(body).sort()).toEqual(['channel_name', 'roles_snapshot', 'scope']);
    });

    it('forwards llm_service / user_name / metadata when given', async () => {
        const client = createMockClient();
        const resource = new ConversationSessionsResource(client as unknown as FetchClient);

        await resource.create({
            channel_name: 'api',
            rolesSnapshot: [],
            scope: 'runtime',
            llmService: 'primary',
            userName: 'a@b.co',
            metadata: { k: 1 },
        });

        expect(client.post.mock.calls[0]![1]).toEqual({
            channel_name: 'api',
            roles_snapshot: [],
            scope: 'runtime',
            llm_service: 'primary',
            user_name: 'a@b.co',
            metadata: { k: 1 },
        });
    });
});

/**
 * `/runtime/flows/events` is the per-step history of flow instances (a `FlowInstance`
 * carries no `steps`). The filters matter as much as the binding: `?flow=` and
 * `?instance_id=` narrow the set, and these assert the SDK puts them on the wire.
 */
describe('FlowsResource — the flow-event surface and its filters', () => {
    it('listEvents sends instance_id when given', async () => {
        const client = createMockClient();
        const resource = new FlowsResource(client as unknown as FetchClient);

        await resource.listEvents({ instanceId: 'i-1' });

        expect(client.get).toHaveBeenCalledWith(
            '/runtime/flows/events', { instance_id: 'i-1' }, { operationId: 'listFlowEvents' },
        );
    });

    it('listEvents sends event_type and locale alongside it', async () => {
        const client = createMockClient();
        const resource = new FlowsResource(client as unknown as FetchClient);

        await resource.listEvents({ instanceId: 'i-1', eventType: 'FlowStepCompleted', locale: 'es' });

        expect(client.get.mock.calls[0]![1]).toEqual({
            locale: 'es', instance_id: 'i-1', event_type: 'FlowStepCompleted',
        });
    });

    it('listEvents sends no query at all when unfiltered', async () => {
        const client = createMockClient();
        const resource = new FlowsResource(client as unknown as FetchClient);

        await resource.listEvents();

        expect(client.get).toHaveBeenCalledWith(
            '/runtime/flows/events', undefined, { operationId: 'listFlowEvents' },
        );
    });

    it('listInstances sends the flow filter', async () => {
        const client = createMockClient();
        const resource = new FlowsResource(client as unknown as FetchClient);

        await resource.listInstances({ flow: 'intake' });

        expect(client.get.mock.calls[0]![1]).toEqual({ flow: 'intake' });
    });
});
