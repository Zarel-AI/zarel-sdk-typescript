// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
/**
 * EmbeddingCredentialsResource.
 *
 * Mock FetchClient; asserts the per-DECLARED-SERVICE routes, the apiKey
 * baseUrl→baseURL casing, and the AWS-shaped passthrough.
 *
 * Every service name here is deliberately NOT a provider name: the credential
 * keys on `embeddings.services[].name`, and the provider is resolved
 * server-side from that declaration. Fixtures named after providers could not tell
 * the two apart.
 */

import { EmbeddingCredentialsResource } from '../src/resources/embedding-credentials';
import type { FetchClient } from '../src/_internal/fetch-client';

type MockClient = { get: jest.Mock; put: jest.Mock; del: jest.Mock };

function createMockClient(): MockClient {
    return {
        get: jest.fn(() => Promise.resolve({ success: true, data: [] })),
        put: jest.fn(() => Promise.resolve({ success: true, data: {} })),
        del: jest.fn(() => Promise.resolve(undefined)),
    };
}

describe('EmbeddingCredentialsResource', () => {
    it('list → GET /runtime/embedding-credentials', async () => {
        const client = createMockClient();
        await new EmbeddingCredentialsResource(client as unknown as FetchClient).list();
        expect(client.get).toHaveBeenCalledWith('/runtime/embedding-credentials', {}, { operationId: 'listEmbeddingCredentials' });
    });

    it('get → GET /runtime/embedding-credentials/{service_name}', async () => {
        const client = createMockClient();
        await new EmbeddingCredentialsResource(client as unknown as FetchClient).get('archival');
        expect(client.get).toHaveBeenCalledWith('/runtime/embedding-credentials/archival', {}, { operationId: 'getEmbeddingCredential' });
    });

    it('put apiKey → maps baseUrl to baseURL on the wire', async () => {
        const client = createMockClient();
        await new EmbeddingCredentialsResource(client as unknown as FetchClient).put('semantic', { apiKey: 'sk', baseUrl: 'https://x' });
        expect(client.put).toHaveBeenCalledWith('/runtime/embedding-credentials/semantic', { apiKey: 'sk', baseURL: 'https://x' }, { operationId: 'setEmbeddingCredential' });
    });

    it('put AWS shape → passes it through under the declared service name', async () => {
        const client = createMockClient();
        const aws = { accessKeyId: 'AKIA', secretAccessKey: 'sk', region: 'us-east-1' };
        await new EmbeddingCredentialsResource(client as unknown as FetchClient).put('cold_storage', aws);
        expect(client.put).toHaveBeenCalledWith('/runtime/embedding-credentials/cold_storage', aws, { operationId: 'setEmbeddingCredential' });
    });

    it('a service name that needs escaping is encoded, not interpolated raw', async () => {
        const client = createMockClient();
        await new EmbeddingCredentialsResource(client as unknown as FetchClient).get('a/b');
        expect(client.get).toHaveBeenCalledWith('/runtime/embedding-credentials/a%2Fb', {}, { operationId: 'getEmbeddingCredential' });
    });

    it('delete → DELETE /runtime/embedding-credentials/{service_name}', async () => {
        const client = createMockClient();
        await new EmbeddingCredentialsResource(client as unknown as FetchClient).delete('semantic');
        expect(client.del).toHaveBeenCalledWith('/runtime/embedding-credentials/semantic', { operationId: 'deleteEmbeddingCredential' });
    });
});
