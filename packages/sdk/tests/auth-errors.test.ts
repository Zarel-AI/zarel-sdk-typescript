// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// Auth error semantics.
//
// Verifies the typed ZarelAuthError discriminated union: plane-specific missing-token
// codes throw before any network I/O, while server-side 401 surfaces as the third distinct code
// ('unauthorized'). The error shape is the discrimination point — code
// consumers MUST be able to branch on `code` without parsing messages.

import { Zarel } from '../src/client';
import { ZarelAuthError } from '../src/errors';

type MockFetch = jest.Mock<Promise<Response>, [input: string | URL | Request, init?: RequestInit]>;

function okFetch(): MockFetch {
    return jest.fn<Promise<Response>, [input: string | URL | Request, init?: RequestInit]>().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, data: {} }),
        headers: new Headers(),
    } as Response);
}

function unauthorizedFetch(): MockFetch {
    return jest.fn<Promise<Response>, [input: string | URL | Request, init?: RequestInit]>().mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({
            error: {
                type: 'unauthorized',
                code: 'invalid_token',
                message: 'JWT signature verification failed',
                request_id: 'req-test-1',
            },
        }),
        headers: new Headers({ 'x-request-id': 'req-test-1' }),
    } as Response);
}

describe('ZarelAuthError discriminated union', () => {
    // runtime_token_missing thrown pre-network
    it('runtime call without runtimeToken throws runtime_token_missing pre-network', async () => {
        const fetchFn = okFetch();
        const zarel = new Zarel({ tenant: 'acme', contractToken: 'ct', fetch: fetchFn, maxRetries: 0 });

        let captured: unknown;
        try {
            await zarel.runtime.records.list('orders');
        } catch (e) {
            captured = e;
        }
        expect(captured).toBeInstanceOf(ZarelAuthError);
        expect((captured as ZarelAuthError).code).toBe('runtime_token_missing');
        expect(fetchFn).not.toHaveBeenCalled();
    });

    // contract_token_missing thrown pre-network
    it('contract call without contractToken throws contract_token_missing pre-network', async () => {
        const fetchFn = okFetch();
        const zarel = new Zarel({ tenant: 'acme', runtimeToken: 'rt', fetch: fetchFn, maxRetries: 0 });

        let captured: unknown;
        try {
            await zarel.contract.entities.list();
        } catch (e) {
            captured = e;
        }
        expect(captured).toBeInstanceOf(ZarelAuthError);
        expect((captured as ZarelAuthError).code).toBe('contract_token_missing');
        expect(fetchFn).not.toHaveBeenCalled();
    });

    // Namespace accessors are safe even when no tokens are set.
    it('accessing .runtime and .contract without any tokens does not throw', () => {
        const zarel = new Zarel({ tenant: 'acme', fetch: okFetch() });
        expect(() => zarel.runtime).not.toThrow();
        expect(() => zarel.contract).not.toThrow();
        // sub-namespaces are also safe to touch
        expect(typeof zarel.runtime.records.list).toBe('function');
        expect(typeof zarel.contract.entities.list).toBe('function');
    });

    // Server-side 401 surfaces 'unauthorized', distinct from the
    // pre-network configuration codes.
    it('server-side 401 surfaces ZarelAuthError with code "unauthorized"', async () => {
        const fetchFn = unauthorizedFetch();
        const zarel = new Zarel({
            tenant: 'acme',
            runtimeToken: 'rt',
            contractToken: 'ct',
            fetch: fetchFn,
            maxRetries: 0,
        });

        let captured: unknown;
        try {
            await zarel.runtime.records.list('orders');
        } catch (e) {
            captured = e;
        }
        expect(captured).toBeInstanceOf(ZarelAuthError);
        expect((captured as ZarelAuthError).code).toBe('unauthorized');
        // The 401 path requires the fetch to actually fire — verifies this
        // is not the pre-network guard.
        expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    // The three codes are all distinguishable on `code`.
    it('all three error codes are distinct on the typed `code` field', async () => {
        // pre-network (runtime)
        const zarelMissingRt = new Zarel({ tenant: 'acme', contractToken: 'ct', fetch: okFetch(), maxRetries: 0 });
        // pre-network (contract)
        const zarelMissingCt = new Zarel({ tenant: 'acme', runtimeToken: 'rt', fetch: okFetch(), maxRetries: 0 });
        // server 401
        const zarelServer401 = new Zarel({
            tenant: 'acme', runtimeToken: 'rt', contractToken: 'ct', fetch: unauthorizedFetch(), maxRetries: 0,
        });

        const codes: string[] = [];
        for (const c of [
            () => zarelMissingRt.runtime.records.list('orders'),
            () => zarelMissingCt.contract.entities.list(),
            () => zarelServer401.runtime.records.list('orders'),
        ]) {
            try { await c(); } catch (e) { codes.push((e as ZarelAuthError).code); }
        }
        expect(new Set(codes)).toEqual(new Set([
            'runtime_token_missing',
            'contract_token_missing',
            'unauthorized',
        ]));
    });
});
