// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
import { FlowsResource } from '../src/resources/flows';
import type { FetchClient } from '../src/_internal/fetch-client';

type MockClient = {
    get: jest.Mock;
    post: jest.Mock;
    patch: jest.Mock;
    del: jest.Mock;
};

function createMockClient(): MockClient {
    return {
        get: jest.fn(() => Promise.resolve({ success: true, data: { executions: [] } })),
        post: jest.fn(() => Promise.resolve({ success: true })),
        patch: jest.fn(() => Promise.resolve({ success: true })),
        del: jest.fn(() => Promise.resolve({ success: true })),
    };
}

describe('FlowsResource', () => {
    it('calls GET /runtime/flows/instances', async () => {
        const client = createMockClient();
        const resource = new FlowsResource(client as unknown as FetchClient);

        await resource.listInstances();

        expect(client.get).toHaveBeenCalledWith('/runtime/flows/instances', undefined, { operationId: 'listFlowInstances' });
    });

    it('calls GET /runtime/flows/instances/:instance_id', async () => {
        const client = createMockClient();
        const resource = new FlowsResource(client as unknown as FetchClient);

        await resource.getInstance('exec:1');

        expect(client.get).toHaveBeenCalledWith('/runtime/flows/instances/exec%3A1', undefined, { operationId: 'getFlowInstance' });
    });

    it('calls PATCH /runtime/flows/callbacks/:callback_id', async () => {
        const client = createMockClient();
        const resource = new FlowsResource(client as unknown as FetchClient);

        // `{action, payload}` is the body the server accepts; a bare `{approved: true}` is
        // refused with 400.
        await resource.resolveCallback('cb:1', { action: 'complete', payload: { approved: true } });

        expect(client.patch).toHaveBeenCalledWith(
            '/runtime/flows/callbacks/cb%3A1',
            { action: 'complete', payload: { approved: true } },
            { operationId: 'resolveFlowCallback' },
        );
    });

    // A mistyped `operationId` is not cosmetic: the transport looks the unwrap decision up
    // by that key, so these pin the id each callback read sends.
    it('calls GET /runtime/flows/callbacks', async () => {
        const client = createMockClient();
        const resource = new FlowsResource(client as unknown as FetchClient);

        await resource.listCallbacks();

        expect(client.get).toHaveBeenCalledWith('/runtime/flows/callbacks', undefined, { operationId: 'listFlowCallbacks' });
    });

    it('calls GET /runtime/flows/callbacks/:id, encoded', async () => {
        const client = createMockClient();
        const resource = new FlowsResource(client as unknown as FetchClient);

        await resource.getCallback('cb:1');

        expect(client.get).toHaveBeenCalledWith('/runtime/flows/callbacks/cb%3A1', undefined, { operationId: 'getFlowCallback' });
    });
});
