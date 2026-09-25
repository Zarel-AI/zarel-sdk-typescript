// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
/**
 * SDK parity test for `client.traces.{get,list}`.
 *
 * Asserts the resource serialises requests to the documented API surface
 * byte-for-byte.
 */
import { TracesResource } from '../../src/resources/traces';

interface FetchClientStub {
    get: jest.Mock;
}

function makeClient(): { resource: TracesResource; client: FetchClientStub } {
    const client: FetchClientStub = {
        get: jest.fn().mockResolvedValue({}),
    };
    const resource = new TracesResource(client as never);
    return { resource, client };
}

describe('TracesResource.get', () => {
    test('issues GET /runtime/traces/{traceId} (URL-encoded)', async () => {
        const { resource, client } = makeClient();
        await resource.get('trc_01J4Z000000000000000000000');
        expect(client.get).toHaveBeenCalledWith('/runtime/traces/trc_01J4Z000000000000000000000', undefined, { operationId: 'getTrace' });
    });
});

describe('TracesResource.list', () => {
    test('serialises filter params as query string', async () => {
        const { resource, client } = makeClient();
        await resource.list({
            flow: 'support_intake',
            user: 'alice',
            from: '2026-05-01T00:00:00Z',
            to: '2026-05-02T00:00:00Z',
            outcome: 'executed',
            limit: 25,
            cursor: 'opaque-cursor-value',
        });

        expect(client.get).toHaveBeenCalledWith('/runtime/traces', {
            flow: 'support_intake',
            user: 'alice',
            from: '2026-05-01T00:00:00Z',
            to: '2026-05-02T00:00:00Z',
            outcome: 'executed',
            limit: 25,
            cursor: 'opaque-cursor-value',
        }, { operationId: 'queryTraces' });
    });

    test('omits undefined params', async () => {
        const { resource, client } = makeClient();
        await resource.list({ outcome: 'executed' });

        expect(client.get).toHaveBeenCalledWith('/runtime/traces', { outcome: 'executed' }, { operationId: 'queryTraces' });
    });

    test('list() with no params still issues a bare GET', async () => {
        const { resource, client } = makeClient();
        await resource.list();
        expect(client.get).toHaveBeenCalledWith('/runtime/traces', {}, { operationId: 'queryTraces' });
    });
});
