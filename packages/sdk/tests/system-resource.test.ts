// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
import { SystemResource } from '../src/resources/system';
import type { FetchClient } from '../src/_internal/fetch-client';

type MockClient = {
    get: jest.Mock;
    post: jest.Mock;
    del: jest.Mock;
};

function createMockClient(): MockClient {
    return {
        get: jest.fn((path: string) => {
            if (path === '/api-keys') {
                return Promise.resolve([{ id: 'key_1', name: 'default', key_prefix: 'zrl_sk_test_' }]);
            }
            if (path === '/metrics') {
                return Promise.resolve({ requests_total: 1 });
            }
            return Promise.resolve({ status: 'healthy', timestamp: new Date().toISOString() });
        }),
        post: jest.fn(() => Promise.resolve({ id: 'key_1', name: 'default', key: 'zrl_sk_test' })),
        del: jest.fn(() => Promise.resolve({ success: true })),
    };
}

describe('SystemResource', () => {
    it('calls GET /health', async () => {
        const client = createMockClient();
        const resource = new SystemResource(client as unknown as FetchClient);

        await resource.health();

        expect(client.get).toHaveBeenCalledWith('/health', undefined, { operationId: 'getHealth' });
    });

    it('calls GET /metrics', async () => {
        const client = createMockClient();
        const resource = new SystemResource(client as unknown as FetchClient);

        await resource.metrics();

        expect(client.get).toHaveBeenCalledWith('/metrics', undefined, { operationId: 'getMetrics' });
    });

    it('calls POST /api-keys', async () => {
        const client = createMockClient();
        const resource = new SystemResource(client as unknown as FetchClient);

        await resource.createApiKey({ name: 'default', scopes: ['records:read'] });

        expect(client.post).toHaveBeenCalledWith('/api-keys', { name: 'default', scopes: ['records:read'] }, { operationId: 'createApiKey' });
    });

    it('calls GET /api-keys', async () => {
        const client = createMockClient();
        const resource = new SystemResource(client as unknown as FetchClient);

        await resource.listApiKeys();

        expect(client.get).toHaveBeenCalledWith('/api-keys', undefined, { operationId: 'listApiKeys' });
    });

    it('calls DELETE /api-keys/:key_id', async () => {
        const client = createMockClient();
        const resource = new SystemResource(client as unknown as FetchClient);

        await resource.deleteApiKey('key:1');

        expect(client.del).toHaveBeenCalledWith('/api-keys/key%3A1', { operationId: 'deleteApiKey' });
    });
});
