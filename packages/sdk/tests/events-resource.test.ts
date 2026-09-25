// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
import { EventsResource } from '../src/resources/events';
import type { FetchClient } from '../src/_internal/fetch-client';

type MockClient = {
    get: jest.Mock;
    post: jest.Mock;
    del: jest.Mock;
};

function createMockClient(): MockClient {
    return {
        get: jest.fn(() => Promise.resolve({ success: true, data: { events: [] } })),
        post: jest.fn(() => Promise.resolve({ success: true, data: { id: 1 } })),
        del: jest.fn(() => Promise.resolve({ success: true, data: { id: 1 } })),
    };
}

describe('EventsResource', () => {
    it('calls GET /runtime/events/delivery', async () => {
        const client = createMockClient();
        const resource = new EventsResource(client as unknown as FetchClient);

        await resource.listDeliveries();

        expect(client.get).toHaveBeenCalledWith('/runtime/events/delivery', undefined, { operationId: 'listEventDeliveries' });
    });
});
