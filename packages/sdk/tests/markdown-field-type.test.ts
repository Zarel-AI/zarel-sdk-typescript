// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// The SDK transmits field_type: 'markdown' unchanged.

import { Zarel } from '../src/client';

type MockFetch = jest.Mock<Promise<Response>, [input: string | URL | Request, init?: RequestInit]>;

function makeClient(): { zarel: Zarel; fetchFn: MockFetch } {
    const fetchFn: MockFetch = jest.fn<Promise<Response>, [input: string | URL | Request, init?: RequestInit]>().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, data: {} }),
        headers: new Headers(),
    } as Response);
    const zarel = new Zarel({
        runtimeToken: 'rt',
        contractToken: 'ct',
        runtimeBaseUrl: 'https://api.test.local/v1',
        contractBaseUrl: 'https://admin.test.local/v1',
        maxRetries: 0,
        fetch: fetchFn,
    });
    return { zarel, fetchFn };
}

function callBody(fetchFn: MockFetch, idx = 0): unknown {
    const c = fetchFn.mock.calls[idx];
    if (!c) throw new Error(`expected fetch call ${idx}`);
    const init = c[1] as RequestInit;
    return init.body ? JSON.parse(init.body as string) as unknown : undefined;
}

describe('SDK markdown field pass-through', () => {
    /**
     * `label` is not part of this body. The server REFUSES it with 400 (semantic content is
     * written by a contract publish), and it is not spellable: `FieldDefinitionInput` is derived
     * from the published, CLOSED request body, so adding it here would not compile.
     */
    it('entities.fields().create() transmits field_type: markdown unchanged', async () => {
        const { zarel, fetchFn } = makeClient();

        await zarel.contract.entities.fields('articles').create({
            name: 'body',
            field_type: 'markdown',
            is_required: true,
        });

        expect(callBody(fetchFn)).toMatchObject({ name: 'body', field_type: 'markdown', is_required: true });
    });
});
