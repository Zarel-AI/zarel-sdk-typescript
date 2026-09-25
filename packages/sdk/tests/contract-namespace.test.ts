// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// Contract namespace host-derivation tests.
//
// Verifies that with `tenant: 'acme'` and no explicit baseUrl,
// contract calls route to `https://acme.admin.zarel.ai/v1/...` via the
// `.admin.` host insertion (the same derivation the Zarel CLI uses).

import { Zarel } from '../src/client';

type MockFetch = jest.Mock<Promise<Response>, [input: string | URL | Request, init?: RequestInit]>;

function okFetch(): MockFetch {
    return jest.fn<Promise<Response>, [input: string | URL | Request, init?: RequestInit]>().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, data: [] }),
        headers: new Headers(),
    } as Response);
}

describe('contract namespace — host derivation', () => {
    it('entities.list with tenant slug targets https://{tenant}.admin.zarel.ai/v1/contract/entities', async () => {
        const fetchFn = okFetch();
        const zarel = new Zarel({ tenant: 'acme', contractToken: 'ct', fetch: fetchFn });
        await zarel.contract.entities.list();
        const [url] = fetchFn.mock.calls[0] as [string];
        const parsed = new URL(url);
        expect(parsed.host).toBe('acme.admin.zarel.ai');
        expect(parsed.pathname).toBe('/v1/contract/entities');
    });

    it('roles.list targets /v1/contract/roles on the contract admin host', async () => {
        const fetchFn = okFetch();
        const zarel = new Zarel({ tenant: 'acme', contractToken: 'ct', fetch: fetchFn });
        await zarel.contract.roles.list();
        const [url] = fetchFn.mock.calls[0] as [string];
        const parsed = new URL(url);
        expect(parsed.host).toBe('acme.admin.zarel.ai');
        expect(parsed.pathname).toBe('/v1/contract/roles');
    });

    it('contractBaseUrl override wins over the derived admin host', async () => {
        const fetchFn = okFetch();
        const zarel = new Zarel({
            tenant: 'acme',
            contractToken: 'ct',
            contractBaseUrl: 'https://admin-staging.example/v1',
            fetch: fetchFn,
        });
        await zarel.contract.entities.list();
        const [url] = fetchFn.mock.calls[0] as [string];
        expect(new URL(url).host).toBe('admin-staging.example');
    });
});
