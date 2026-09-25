// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
import { Zarel } from '../src/client';
import { RuntimeNamespace } from '../src/runtime';
import { ContractNamespace } from '../src/contract';
import { ToolsResource } from '../src/resources/tools';
import { RecordsResource } from '../src/resources/records';
import { RoleAssignmentsResource } from '../src/resources/role-assignments';
import { SystemResource } from '../src/resources/system';

type MockFetch = jest.Mock<Promise<Response>, [input: string | URL | Request, init?: RequestInit]>;

function noopFetch(): MockFetch {
    return jest.fn<Promise<Response>, [input: string | URL | Request, init?: RequestInit]>().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, data: null }),
        headers: new Headers(),
    } as Response);
}

describe('Zarel Client', () => {
    it('exposes resource instances through the namespace surface', () => {
        const zarel = new Zarel({
            runtimeToken: 'rt',
            contractToken: 'ct',
            runtimeBaseUrl: 'https://api.test.com/v1',
            fetch: noopFetch(),
        });

        // The runtime namespace composes existing Resource classes
        // (idiomatic taxonomy).
        expect(zarel.runtime.tools).toBeInstanceOf(ToolsResource);
        expect(zarel.runtime.records).toBeInstanceOf(RecordsResource);
        expect(zarel.runtime.roles.assignments).toBeInstanceOf(RoleAssignmentsResource);
        expect(zarel.runtime.system).toBeInstanceOf(SystemResource);
        // sub-namespaces (conversation collapse, flows nesting, events nesting,
        // stateMachine grouping) are exposed as wrapper objects whose
        // identity is tested in namespace-smoke.test.ts.
    });

    it('generates tenant-based URL when tenant is provided', async () => {
        const fetchFn = noopFetch();
        const zarel = new Zarel({
            runtimeToken: 'rt',
            tenant: 'acme',
            fetch: fetchFn,
        });

        await zarel.runtime.conversation.sessions.list();

        const [url] = fetchFn.mock.calls[0] as [string];
        expect(url).toContain('acme.zarel.ai');
    });

    it('uses runtimeBaseUrl when provided (overrides tenant)', async () => {
        const fetchFn = noopFetch();
        const zarel = new Zarel({
            runtimeToken: 'rt',
            tenant: 'acme',
            runtimeBaseUrl: 'https://custom.api.com/v1',
            fetch: fetchFn,
        });

        await zarel.runtime.conversation.sessions.list();

        const [url] = fetchFn.mock.calls[0] as [string];
        expect(url).toContain('custom.api.com');
        expect(url).not.toContain('acme.zarel.ai');
    });

    it('defaults to api.zarel.ai when no tenant or runtimeBaseUrl', async () => {
        const fetchFn = noopFetch();
        const zarel = new Zarel({
            runtimeToken: 'rt',
            fetch: fetchFn,
        });

        await zarel.runtime.conversation.sessions.list();

        const [url] = fetchFn.mock.calls[0] as [string];
        expect(url).toContain('api.zarel.ai');
    });

    // Construction never throws on missing/empty tokens: accessing
    // `client.runtime` and `client.contract` is always
    // safe; only method invocations on an unconfigured plane throw.
    it('does not throw when tokens are empty (lazy validation)', () => {
        expect(() => new Zarel({
            runtimeBaseUrl: 'https://api.test.com/v1',
            fetch: noopFetch(),
        })).not.toThrow();
    });

    // Smoke: both namespaces are accessible after
    // construction regardless of token presence.
    describe('namespace surface', () => {
        it('exposes runtime and contract namespaces', () => {
            const zarel = new Zarel({
                tenant: 'acme',
                runtimeToken: 'rt',
                contractToken: 'ct',
                fetch: noopFetch(),
            });
            expect(zarel.runtime).toBeInstanceOf(RuntimeNamespace);
            expect(zarel.contract).toBeInstanceOf(ContractNamespace);
        });

        it('exposes namespaces even when no tokens configured (lazy validation)', () => {
            const zarel = new Zarel({ tenant: 'acme', fetch: noopFetch() });
            expect(zarel.runtime).toBeInstanceOf(RuntimeNamespace);
            expect(zarel.contract).toBeInstanceOf(ContractNamespace);
        });

        it('exposes namespaces when only one plane token is configured', () => {
            const zarelRuntime = new Zarel({ tenant: 'acme', runtimeToken: 'rt', fetch: noopFetch() });
            expect(zarelRuntime.runtime).toBeInstanceOf(RuntimeNamespace);
            expect(zarelRuntime.contract).toBeInstanceOf(ContractNamespace);

            const zarelContract = new Zarel({ tenant: 'acme', contractToken: 'ct', fetch: noopFetch() });
            expect(zarelContract.runtime).toBeInstanceOf(RuntimeNamespace);
            expect(zarelContract.contract).toBeInstanceOf(ContractNamespace);
        });

        // Both baseUrl overrides win simultaneously over tenant-derived
        // defaults. Verified end-to-end by exercising both planes in one run.
        it('runtimeBaseUrl + contractBaseUrl overrides both win over tenant', async () => {
            const fetchFn = noopFetch();
            const zarel = new Zarel({
                tenant: 'acme',
                runtimeToken: 'rt',
                contractToken: 'ct',
                runtimeBaseUrl: 'https://api-staging.example/v1',
                contractBaseUrl: 'https://admin-staging.example/v1',
                fetch: fetchFn,
            });
            await zarel.runtime.tools.list();
            await zarel.contract.entities.list();

            const [rtUrl] = fetchFn.mock.calls[0] as [string];
            const [ctUrl] = fetchFn.mock.calls[1] as [string];
            expect(new URL(rtUrl).host).toBe('api-staging.example');
            expect(new URL(ctUrl).host).toBe('admin-staging.example');
            // Neither tenant-derived host should leak.
            expect(rtUrl).not.toContain('acme.zarel.ai');
            expect(ctUrl).not.toContain('acme.admin.zarel.ai');
        });
    });
});
