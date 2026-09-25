// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// client.contract.assistant.* accessors.
//
// Verifies the 5 accessors target the contract plane, unwrap the
// {success,data} envelope, that conversationSend never touches the apply path,
// and that the apply 409 staleness body's structured reseed fields
// survive on the thrown ZarelAPIError.details.

import { Zarel } from '../src/client';
import { ZarelAPIError } from '../src/errors';

type MockFetch = jest.Mock<Promise<Response>, [input: string | URL | Request, init?: RequestInit]>;

function jsonFetch(status: number, payload: unknown): MockFetch {
    return jest.fn<Promise<Response>, [input: string | URL | Request, init?: RequestInit]>().mockResolvedValue({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(payload),
        headers: new Headers({ 'content-type': 'application/json' }),
    } as Response);
}

function client(fetchFn: MockFetch): Zarel {
    return new Zarel({ tenant: 'acme', contractToken: 'ct', fetch: fetchFn });
}

function callOf(fetchFn: MockFetch, i = 0): { url: URL; method: string; body: unknown } {
    const [rawUrl, init] = fetchFn.mock.calls[i] as [string, RequestInit];
    return {
        url: new URL(rawUrl),
        method: (init?.method ?? 'GET').toUpperCase(),
        body: init?.body ? JSON.parse(init.body as string) : undefined,
    };
}

describe('contract.assistant — plane + envelope', () => {
    it('createSession POSTs to the contract-plane sessions path and unwraps', async () => {
        const f = jsonFetch(201, { success: true, data: { session_key: 's-1' } });
        const out = await client(f).contract.assistant.createSession({ llm_service: 'primary' });
        const c = callOf(f);
        expect(c.url.host).toBe('acme.admin.zarel.ai');
        expect(c.url.pathname).toBe('/v1/contract/assistant/conversation/sessions');
        expect(c.method).toBe('POST');
        expect(out).toEqual({ session_key: 's-1' });
    });

    it('conversationSend POSTs to conversation/send and unwraps {reply, changeset_id}', async () => {
        const f = jsonFetch(200, { success: true, data: { reply: 'ok', changeset_id: 'cs-1' } });
        const out = await client(f).contract.assistant.conversationSend({ session_key: 's-1', message: 'hi' });
        const c = callOf(f);
        expect(c.url.pathname).toBe('/v1/contract/assistant/conversation/send');
        expect(c.body).toMatchObject({ session_key: 's-1', message: 'hi' });
        expect(out).toEqual({ reply: 'ok', changeset_id: 'cs-1' });
    });

    it('getChangeset GETs the changeset path', async () => {
        const f = jsonFetch(200, { success: true, data: { id: 'cs-1', status: 'pending', base_hash: 'v3', draft_yaml: 'x', diff: null } });
        await client(f).contract.assistant.getChangeset('cs-1');
        const c = callOf(f);
        expect(c.method).toBe('GET');
        expect(c.url.pathname).toBe('/v1/contract/assistant/changesets/cs-1');
    });

    it('applyChangeset POSTs base_hash to the apply path', async () => {
        const f = jsonFetch(200, { success: true, data: { applied: true, applied_version: 4, diff: null, stripped_grants: [] } });
        const out = await client(f).contract.assistant.applyChangeset('cs-1', { base_hash: 'v3' });
        const c = callOf(f);
        expect(c.url.pathname).toBe('/v1/contract/assistant/changesets/cs-1/apply');
        expect(c.body).toMatchObject({ base_hash: 'v3' });
        expect(out).toMatchObject({ applied_version: 4 });
    });

    it('discardChangeset POSTs the discard path', async () => {
        const f = jsonFetch(200, { success: true, data: { discarded: true } });
        await client(f).contract.assistant.discardChangeset('cs-1');
        expect(callOf(f).url.pathname).toBe('/v1/contract/assistant/changesets/cs-1/discard');
    });
});

describe('contract.assistant — conversationSend never applies', () => {
    it('a single conversationSend issues exactly one request, to conversation/send (no apply/discard)', async () => {
        const f = jsonFetch(200, { success: true, data: { reply: 'ok', changeset_id: 'cs-1' } });
        await client(f).contract.assistant.conversationSend({ session_key: 's-1', message: 'add a field' });
        expect(f).toHaveBeenCalledTimes(1);
        const paths = f.mock.calls.map(([u]) => new URL(u as string).pathname);
        expect(paths.some((p) => p.endsWith('/apply') || p.endsWith('/discard'))).toBe(false);
    });
});

describe('contract.assistant — apply 409 reseed details survive', () => {
    it('applyChangeset rejects with ZarelAPIError carrying details.reseeded_changeset_id', async () => {
        const f = jsonFetch(409, {
            error: { type: 'conflict', code: 'contract_hash_mismatch', message: 'stale' },
            reseeded_changeset_id: 'cs-9',
            base_hash: 'v8',
        });
        await expect(client(f).contract.assistant.applyChangeset('cs-1', { base_hash: 'v3' }))
            .rejects.toMatchObject({ code: 'contract_hash_mismatch' });

        const f2 = jsonFetch(409, {
            error: { type: 'conflict', code: 'contract_hash_mismatch', message: 'stale' },
            reseeded_changeset_id: 'cs-9',
            base_hash: 'v8',
        });
        try {
            await client(f2).contract.assistant.applyChangeset('cs-1', { base_hash: 'v3' });
            throw new Error('expected throw');
        } catch (err) {
            expect(err).toBeInstanceOf(ZarelAPIError);
            const e = err as ZarelAPIError;
            expect(e.details?.reseeded_changeset_id).toBe('cs-9');
            expect(e.details?.base_hash).toBe('v8');
        }
    });
});
