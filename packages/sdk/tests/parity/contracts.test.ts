// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
/**
 * SDK parity test for `client.contract.spec.*`.
 */

import { SpecResource } from '../../src/resources/contracts';

interface FetchClientStub {
    get: jest.Mock;
    post: jest.Mock;
}

function makeClient(): { resource: SpecResource; client: FetchClientStub } {
    const client: FetchClientStub = {
        get: jest.fn().mockResolvedValue({}),
        post: jest.fn().mockResolvedValue({}),
    };
    const resource = new SpecResource(client as never);
    return { resource, client };
}

describe('SpecResource — spec surface', () => {
    test('publish() POSTs to /contract/spec/publish', async () => {
        const { resource, client } = makeClient();
        await resource.publish({
            files: { structural: 'name: x' },
            mode: 'upsert',
        });
        expect(client.post).toHaveBeenCalledWith('/contract/spec/publish', {
            files: { structural: 'name: x' },
            mode: 'upsert',
        }, { operationId: 'specPublish' });
    });

    test('publish() forwards two-plane files', async () => {
        const { resource, client } = makeClient();
        await resource.publish({
            files: {
                structural: 'name: x',
                semanticByLocale: { en: 'entities:\n  tickets:\n    label: Tickets\n' },
            },
            mode: 'upsert',
        });
        expect(client.post).toHaveBeenCalledWith('/contract/spec/publish', {
            files: {
                structural: 'name: x',
                semanticByLocale: { en: 'entities:\n  tickets:\n    label: Tickets\n' },
            },
            mode: 'upsert',
        }, { operationId: 'specPublish' });
    });

    test('diff() POSTs to /contract/spec/diff', async () => {
        const { resource, client } = makeClient();
        await resource.diff({ proposed_spec: 'name: x' });
        expect(client.post).toHaveBeenCalledWith('/contract/spec/diff', { proposed_spec: 'name: x' }, { operationId: 'specDiff' });
    });

    test('apply() POSTs to /contract/spec/apply with gating', async () => {
        const { resource, client } = makeClient();
        await resource.apply({
            files: { structural: 'name: x' },
            mode: 'replace',
            expected_hash: 'v7',
            gating: { reject_breaking_changes: true },
        });
        expect(client.post).toHaveBeenCalledWith('/contract/spec/apply', {
            files: { structural: 'name: x' },
            mode: 'replace',
            expected_hash: 'v7',
            gating: { reject_breaking_changes: true },
        }, { operationId: 'specApply' });
    });

    test('snapshot() GETs /contract/spec/snapshot', async () => {
        const { resource, client } = makeClient();
        await resource.snapshot();
        expect(client.get).toHaveBeenCalledWith('/contract/spec/snapshot', undefined, { operationId: 'specSnapshot' });
    });

    test('snapshot() GETs /contract/spec/snapshot and wraps the flat contract body', async () => {
        // The endpoint returns the flat TenantContract directly (no
        // {success,data} envelope), so the response IS the contract; the V1
        // wrapper carries it under `.contract` without a `.data` unwrap (reading
        // `.data` here would erase entities/roles).
        const flatContract = {
            contract_version: 7,
            spec_version: '1.0',
            metadata: { name: 'support' },
            roles: [],
            entities: [{ name: 'tickets' }],
        };
        const client: FetchClientStub = {
            get: jest.fn().mockResolvedValue(flatContract),
            post: jest.fn().mockResolvedValue({}),
        };
        const resource = new SpecResource(client as never);

        const result = await resource.snapshot();

        expect(client.get).toHaveBeenCalledWith('/contract/spec/snapshot', undefined, { operationId: 'specSnapshot' });
        expect(result).toEqual({
            tenant_name: 'support',
            spec_version: '1.0',
            contract_version: 7,
            hash: 'v7',
            contract: flatContract,
        });
        // entities survive the wrap (the regression this test pins).
        expect((result.contract as { entities: unknown[] }).entities).toHaveLength(1);
    });
});
