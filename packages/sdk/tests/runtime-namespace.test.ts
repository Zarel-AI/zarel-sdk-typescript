// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// Runtime namespace host-derivation tests.
//
// Verifies that with `tenant: 'acme'` and no explicit baseUrl,
// runtime calls route to `https://acme.zarel.ai/v1/...` against the
// canonical runtime API path mounted under `/v1/`.

import { Zarel } from '../src/client';

type MockFetch = jest.Mock<Promise<Response>, [input: string | URL | Request, init?: RequestInit]>;

function okFetch(): MockFetch {
    return jest.fn<Promise<Response>, [input: string | URL | Request, init?: RequestInit]>().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, data: { records: [] } }),
        headers: new Headers(),
    } as Response);
}

describe('runtime namespace — host derivation', () => {
    it('records.list with tenant slug targets https://{tenant}.zarel.ai/v1/runtime/records/{entity}', async () => {
        const fetchFn = okFetch();
        const zarel = new Zarel({ tenant: 'acme', runtimeToken: 'rt', fetch: fetchFn });
        await zarel.runtime.records.list('orders');
        const [url] = fetchFn.mock.calls[0] as [string];
        const parsed = new URL(url);
        expect(parsed.host).toBe('acme.zarel.ai');
        expect(parsed.pathname).toBe('/v1/runtime/records/orders');
    });

    it('tools.list targets /v1/runtime/tools on the tenant runtime host', async () => {
        const fetchFn = okFetch();
        const zarel = new Zarel({ tenant: 'acme', runtimeToken: 'rt', fetch: fetchFn });
        await zarel.runtime.tools.list();
        const [url] = fetchFn.mock.calls[0] as [string];
        const parsed = new URL(url);
        expect(parsed.host).toBe('acme.zarel.ai');
        expect(parsed.pathname).toBe('/v1/runtime/tools');
    });

    it('no tenant + no runtimeBaseUrl falls back to api.zarel.ai', async () => {
        const fetchFn = okFetch();
        const zarel = new Zarel({ runtimeToken: 'rt', fetch: fetchFn });
        await zarel.runtime.tools.list();
        const [url] = fetchFn.mock.calls[0] as [string];
        expect(new URL(url).host).toBe('api.zarel.ai');
    });
});
