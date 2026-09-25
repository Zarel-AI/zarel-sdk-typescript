// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// Authorization-matrices SDK surface.
//
// The authorization surface is ONE path-addressed resource:
// `contract.authorization.*(role, on-path)` mapping to
// `/contract/authorization/{role}/<on-path>`. This asserts that surface
// (grant=POST, replace=PUT, merge=PATCH, revoke=DELETE), the read-only ceiling
// introspection (GET), and that the earlier plane-partitioned `policies` namespace
// is gone from the SDK.

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

function call(fetchFn: MockFetch, i = 0): { method: string; path: string; body: unknown } {
    const [url, init] = fetchFn.mock.calls[i] as [string, RequestInit];
    return {
        method: (init?.method ?? 'GET').toUpperCase(),
        path: new URL(url).pathname,
        body: init?.body ? JSON.parse(init.body as string) : undefined,
    };
}

function zarel(fetchFn: MockFetch): Zarel {
    return new Zarel({ tenant: 'acme', contractToken: 'ct', fetch: fetchFn });
}

describe('authorization-matrices SDK surface', () => {
    describe('contract.authorization.ceiling (read-only)', () => {
        it('get() → GET /v1/contract/authorizations/ceiling', async () => {
            const f = okFetch();
            await zarel(f).contract.authorization.ceiling.get();
            const c = call(f);
            expect(c.method).toBe('GET');
            expect(c.path).toBe('/v1/contract/authorizations/ceiling');
        });
    });

    describe('contract.authorization grants (addressed by role + on-path)', () => {
        it('create(role, grant) → POST /v1/contract/authorization/{role} (grant on a fresh on-path)', async () => {
            const f = okFetch();
            await zarel(f).contract.authorization.create('auditor', { on: 'flows', actions: ['read'] });
            const c = call(f);
            expect(c.method).toBe('POST');
            expect(c.path).toBe('/v1/contract/authorization/auditor');
            expect(c.body).toEqual({ on: 'flows', actions: ['read'] });
        });
        it('put(role, onPath, actions) → PUT the grant (idempotent replace)', async () => {
            const f = okFetch();
            await zarel(f).contract.authorization.put('auditor', 'flows', ['read', 'update']);
            const c = call(f);
            expect(c.method).toBe('PUT');
            expect(c.path).toBe('/v1/contract/authorization/auditor/flows');
            expect(c.body).toEqual({ actions: ['read', 'update'] });
        });
        it('patch(role, onPath, actions) → PATCH the grant (merge)', async () => {
            const f = okFetch();
            await zarel(f).contract.authorization.patch('auditor', 'flows', ['delete']);
            const c = call(f);
            expect(c.method).toBe('PATCH');
            expect(c.path).toBe('/v1/contract/authorization/auditor/flows');
            expect(c.body).toEqual({ actions: ['delete'] });
        });
        it('del(role, onPath) → DELETE the grant (revoke)', async () => {
            const f = okFetch();
            await zarel(f).contract.authorization.del('auditor', 'flows');
            const c = call(f);
            expect(c.method).toBe('DELETE');
            expect(c.path).toBe('/v1/contract/authorization/auditor/flows');
        });
        it('the on-path travels as real path segments (records/orders is NOT encoded)', async () => {
            const f = okFetch();
            await zarel(f).contract.authorization.del('clerk', 'records/orders');
            expect(call(f).path).toBe('/v1/contract/authorization/clerk/records/orders');
        });
        it('no longer exposes the retired plane-partitioned policies surface', () => {
            const c = zarel(okFetch()).contract as unknown as Record<string, unknown>;
            expect(c.policies).toBeUndefined();
        });
    });

    // Regression: `list`/`get` once interpolated the `localeQuery` RECORD into the
    // path string (`…[object Object]` → 404) AND silently dropped the locale. The
    // locale is a QUERY parameter, mirroring `SpecResource.snapshotLocaleCoverage`.
    describe('contract.authorization reads (list/get) — locale is a query param, not a path segment', () => {
        function urlOf(f: MockFetch): URL {
            return new URL((f.mock.calls[0] as [string, RequestInit])[0]);
        }

        it('list(role) → GET /v1/contract/authorization/{role} with no query', async () => {
            const f = okFetch();
            await zarel(f).contract.authorization.list('auditor');
            expect(call(f).method).toBe('GET');
            const u = urlOf(f);
            expect(u.pathname).toBe('/v1/contract/authorization/auditor');
            expect(u.search).toBe('');
        });

        it('list(role, {locale}) → ?locale=en in the query, never [object Object] in the path', async () => {
            const f = okFetch();
            await zarel(f).contract.authorization.list('auditor', { locale: 'en' });
            const u = urlOf(f);
            expect(u.pathname).toBe('/v1/contract/authorization/auditor');
            expect(u.pathname).not.toContain('object');
            expect(u.searchParams.get('locale')).toBe('en');
        });

        it('get(role, onPath) → GET /v1/contract/authorization/{role}/{onPath} with no query', async () => {
            const f = okFetch();
            await zarel(f).contract.authorization.get('auditor', 'flows');
            expect(call(f).method).toBe('GET');
            const u = urlOf(f);
            expect(u.pathname).toBe('/v1/contract/authorization/auditor/flows');
            expect(u.search).toBe('');
        });

        it('get(role, onPath, {locale}) → ?locale=en in the query, never [object Object] in the path', async () => {
            const f = okFetch();
            await zarel(f).contract.authorization.get('auditor', 'flows', { locale: 'en' });
            const u = urlOf(f);
            expect(u.pathname).toBe('/v1/contract/authorization/auditor/flows');
            expect(u.pathname).not.toContain('object');
            expect(u.searchParams.get('locale')).toBe('en');
        });
    });
});
