// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// SDK token-provider + transport mode.
//
// Three behaviors:
//  (a) `token` accepts string | (() => string | Promise<string>) and resolves it
//      into the Authorization header before each request.
//  (b) transport-managed mode (the proxy injects the token) OMITS the
//      Authorization header entirely AND skips the requireToken guard.
//  (c) a direct consumer (no token, not transport-managed) still throws
//      `*_token_missing` before any network I/O (opt-in only).

import { Zarel } from '../src/client';
import { ZarelAuthError } from '../src/errors';
import { makeMockFetch, callInit, type MockFetch } from './_helpers/record-fetch';

function authOf(fetchFn: MockFetch, index = 0): string | undefined {
    const headers = callInit(fetchFn, index).headers as Record<string, string> | undefined;
    return headers?.['Authorization'];
}

describe('token-provider — string | function resolution', () => {
    it('accepts a static string token (unchanged behavior)', async () => {
        const fetchFn = makeMockFetch();
        const z = new Zarel({ runtimeToken: 'static-rt', runtimeBaseUrl: 'https://acme.example.com/v1', maxRetries: 0, fetch: fetchFn });
        await z.runtime.tools.list();
        expect(authOf(fetchFn)).toBe('Bearer static-rt');
    });

    it('resolves a sync function provider', async () => {
        const fetchFn = makeMockFetch();
        const z = new Zarel({ runtimeToken: () => 'fn-rt', runtimeBaseUrl: 'https://acme.example.com/v1', maxRetries: 0, fetch: fetchFn });
        await z.runtime.tools.list();
        expect(authOf(fetchFn)).toBe('Bearer fn-rt');
    });

    it('resolves an async function provider', async () => {
        const fetchFn = makeMockFetch();
        const z = new Zarel({ contractToken: async () => 'async-ct', contractBaseUrl: 'https://acme.admin.example.com/v1', maxRetries: 0, fetch: fetchFn });
        await z.contract.entities.list();
        expect(authOf(fetchFn)).toBe('Bearer async-ct');
    });
});

describe('transport-managed mode — omits the Authorization header', () => {
    it('sends NO Authorization header on either plane and never throws for a missing token', async () => {
        const fetchFn = makeMockFetch();
        const z = new Zarel({
            transportManaged: true,
            runtimeBaseUrl: 'https://acme.example.com/v1',
            contractBaseUrl: 'https://acme.admin.example.com/v1',
            maxRetries: 0,
            fetch: fetchFn,
        });
        await z.runtime.tools.list();
        await z.contract.entities.list();
        expect(authOf(fetchFn, 0)).toBeUndefined();
        expect(authOf(fetchFn, 1)).toBeUndefined();
    });
});

describe('opt-in guard — direct consumers still required to provide a token', () => {
    it('throws runtime_token_missing before I/O when no token and not transport-managed', async () => {
        const fetchFn = makeMockFetch();
        const z = new Zarel({ runtimeBaseUrl: 'https://acme.example.com/v1', maxRetries: 0, fetch: fetchFn });
        await expect(z.runtime.tools.list()).rejects.toMatchObject({ code: 'runtime_token_missing' });
        expect(fetchFn).not.toHaveBeenCalled();
    });

    it('throws contract_token_missing for the contract plane', async () => {
        const fetchFn = makeMockFetch();
        const z = new Zarel({ contractBaseUrl: 'https://acme.admin.example.com/v1', maxRetries: 0, fetch: fetchFn });
        await expect(z.contract.entities.list()).rejects.toBeInstanceOf(ZarelAuthError);
        expect(fetchFn).not.toHaveBeenCalled();
    });
});
