// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// Namespace smoke tests.
// Verifies the client.runtime.* / client.contract.* surface is
// reachable, that the idiomatic taxonomy renders the expected
// sub-namespace shape, and that the FetchClient lazy-token guard
// throws ZarelAuthError with plane-specific codes before any network
// I/O when a plane token is unconfigured.

import { Zarel } from '../src/client';
import { ZarelAuthError } from '../src/errors';

type MockFetch = jest.Mock<Promise<Response>, [input: string | URL | Request, init?: RequestInit]>;

function noopFetch(): MockFetch {
    return jest.fn<Promise<Response>, [input: string | URL | Request, init?: RequestInit]>().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, data: null }),
        headers: new Headers(),
    } as Response);
}

describe('namespace surface', () => {
    it('exposes the idiomatic taxonomy under runtime', () => {
        const fetchFn = noopFetch();
        const zarel = new Zarel({
            tenant: 'acme',
            runtimeToken: 'rt',
            contractToken: 'ct',
            fetch: fetchFn,
        });
        // Nesting / collapse:
        expect(typeof zarel.runtime.records.list).toBe('function');
        expect(typeof zarel.runtime.records.bulk).toBe('function');
        expect(typeof zarel.runtime.conversation.send).toBe('function');
        expect(typeof zarel.runtime.conversation.sessions.list).toBe('function');
        expect(typeof zarel.runtime.conversation.sessions.actions.list).toBe('function');
        expect(typeof zarel.runtime.flows.instances.list).toBe('function');
        expect(typeof zarel.runtime.flows.callbacks.list).toBe('function');
        expect(typeof zarel.runtime.flows.callbacks.get).toBe('function');
        expect(typeof zarel.runtime.flows.callbacks.resolve).toBe('function');
        expect(typeof zarel.runtime.events.subscriptions.create).toBe('function');
        expect(typeof zarel.runtime.events.deliveries.list).toBe('function');
        expect(typeof zarel.runtime.roles.assignments.list).toBe('function');
        expect(typeof zarel.runtime.llm.services.list).toBe('function');
        expect(typeof zarel.runtime.llm.credentials.put).toBe('function');
        expect(typeof zarel.runtime.imports.snapshot).toBe('function');
        expect(typeof zarel.runtime.traces.get).toBe('function');
        expect(typeof zarel.runtime.actions.dispatch).toBe('function');
        expect(typeof zarel.runtime.stateMachine.replay).toBe('function');
    });

    it('exposes the contract taxonomy', () => {
        const fetchFn = noopFetch();
        const zarel = new Zarel({
            tenant: 'acme',
            runtimeToken: 'rt',
            contractToken: 'ct',
            fetch: fetchFn,
        });
        expect(typeof zarel.contract.spec.publish).toBe('function');
        expect(typeof zarel.contract.spec.dryRun.submit).toBe('function');
        expect(typeof zarel.contract.spec.dryRun.cancel).toBe('function');
        expect(typeof zarel.contract.entities.create).toBe('function');
        expect(typeof zarel.contract.entities.put).toBe('function');
        expect(typeof zarel.contract.entities.fields('orders').create).toBe('function');
        // Full-coverage audit: field read/replace + the transitions sub-resource.
        expect(typeof zarel.contract.entities.fields('orders').list).toBe('function');
        expect(typeof zarel.contract.entities.fields('orders').put).toBe('function');
        expect(typeof zarel.contract.entities.fields('orders').transitions('status').create).toBe('function');
        // Flow patch + steps / on-completion sub-resources.
        expect(typeof zarel.contract.flows.patch).toBe('function');
        expect(typeof zarel.contract.flows.steps('intake').list).toBe('function');
        expect(typeof zarel.contract.flows.onCompletion('intake').get).toBe('function');
        expect(typeof zarel.contract.roles.list).toBe('function');
        expect(typeof zarel.contract.roles.put).toBe('function');
        // Path-addressed authorization (no policies/llmServices split).
        expect(typeof zarel.contract.authorization.list).toBe('function');
        expect(typeof zarel.contract.authorization.ceiling.get).toBe('function');
        // Contract sections + the contract roots
        // (no admin/singletons levels).
        expect(typeof zarel.contract.capabilities.list).toBe('function');
        expect(typeof zarel.contract.metadata.get).toBe('function');
        expect(typeof zarel.contract.processModel.get).toBe('function');
        expect(typeof zarel.contract.processModel.phases.list).toBe('function');
        expect(typeof zarel.contract.events.rules.list).toBe('function');
        expect(typeof zarel.contract.llm.get).toBe('function');
        expect(typeof zarel.contract.mcpServers.list).toBe('function');
        expect(typeof zarel.contract.events.delivery.get).toBe('function');
    });

    it('throws ZarelAuthError with code "runtime_token_missing" when runtimeToken is absent', async () => {
        const fetchFn = noopFetch();
        const zarel = new Zarel({
            tenant: 'acme',
            contractToken: 'ct',
            fetch: fetchFn,
        });
        await expect(zarel.runtime.records.list('orders')).rejects.toMatchObject({
            name: 'ZarelAuthError',
            code: 'runtime_token_missing',
        });
        expect(fetchFn).not.toHaveBeenCalled();
    });

    it('throws ZarelAuthError with code "contract_token_missing" when contractToken is absent', async () => {
        const fetchFn = noopFetch();
        const zarel = new Zarel({
            tenant: 'acme',
            runtimeToken: 'rt',
            fetch: fetchFn,
        });
        await expect(zarel.contract.entities.list()).rejects.toMatchObject({
            name: 'ZarelAuthError',
            code: 'contract_token_missing',
        });
        expect(fetchFn).not.toHaveBeenCalled();
    });

    it('the missing-token error IS a ZarelAuthError', async () => {
        const fetchFn = noopFetch();
        const zarel = new Zarel({ tenant: 'acme', fetch: fetchFn });
        let err: unknown;
        try {
            await zarel.runtime.records.list('orders');
        } catch (e) {
            err = e;
        }
        expect(err).toBeInstanceOf(ZarelAuthError);
    });

    it('targets the runtime host derived from tenant slug', async () => {
        const fetchFn = noopFetch();
        const zarel = new Zarel({
            tenant: 'acme',
            runtimeToken: 'rt',
            fetch: fetchFn,
        });
        await zarel.runtime.tools.list();
        const [url] = fetchFn.mock.calls[0] as [string];
        expect(url).toContain('acme.zarel.ai');
        expect(url).not.toContain('admin');
    });

    it('targets the contract host derived from tenant slug', async () => {
        const fetchFn = noopFetch();
        const zarel = new Zarel({
            tenant: 'acme',
            contractToken: 'ct',
            fetch: fetchFn,
        });
        await zarel.contract.entities.list();
        const [url] = fetchFn.mock.calls[0] as [string];
        expect(url).toContain('acme.admin.zarel.ai');
    });

    it('respects explicit runtimeBaseUrl / contractBaseUrl overrides', async () => {
        const fetchFn = noopFetch();
        const zarel = new Zarel({
            tenant: 'acme',
            runtimeBaseUrl: 'https://api-staging.example/v1',
            contractBaseUrl: 'https://admin-staging.example/v1',
            runtimeToken: 'rt',
            contractToken: 'ct',
            fetch: fetchFn,
        });
        await zarel.runtime.tools.list();
        const [rtUrl] = fetchFn.mock.calls[0] as [string];
        expect(rtUrl).toContain('api-staging.example');
        expect(rtUrl).not.toContain('acme.zarel.ai');

        await zarel.contract.entities.list();
        const [ctUrl] = fetchFn.mock.calls[1] as [string];
        expect(ctUrl).toContain('admin-staging.example');
    });
});
