// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// Observable parity — the codegen map produces the per-class result shapes
// EXACTLY, using the REAL generated maps:
//   - envelope op  → returns `data` (envelope stripped)
//   - flat op      → returns the whole `{success, …siblings}` body
//   - bare op      → returns the whole body
import { FetchClient } from '../src/_internal/fetch-client';
import { RUNTIME_OPERATIONS, CONTRACT_OPERATIONS } from '../src/generated/unwrap-map';

type MockFetch = jest.Mock<Promise<Response>, [input: string | URL | Request, init?: RequestInit]>;

function mockFetch(body: unknown): MockFetch {
    return jest.fn<Promise<Response>, [input: string | URL | Request, init?: RequestInit]>().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.resolve(body),
        headers: new Headers({ 'content-type': 'application/json' }),
    } as Response);
}

function runtimeClient(fetchFn: MockFetch): FetchClient {
    return new FetchClient({ baseUrl: 'https://t.example.com/v1', token: 't', maxRetries: 0, fetch: fetchFn, operations: RUNTIME_OPERATIONS });
}
function contractClient(fetchFn: MockFetch): FetchClient {
    return new FetchClient({ baseUrl: 'https://t.admin.example.com/v1', token: 't', maxRetries: 0, fetch: fetchFn, operations: CONTRACT_OPERATIONS });
}

describe('golden parity (per-class result shape)', () => {
    it('envelope op (listRuntimeRecords) → unwrapped {records,total}', async () => {
        const payload = { records: [{ id: 1 }], total: 1 };
        const c = runtimeClient(mockFetch({ success: true, data: payload }));
        expect(await c.get('/runtime/records/plans', undefined, { operationId: 'listRuntimeRecords' })).toEqual(payload);
    });

    it('flat op (runtimeConversationSend) → whole {success,message,…} body', async () => {
        const flat = { success: true, message: 'hi', intent_type: 'conversation.greeting' };
        const c = runtimeClient(mockFetch(flat));
        expect(await c.post('/runtime/conversation/send', {}, { operationId: 'runtimeConversationSend' })).toEqual(flat);
    });

    it('flat op (runtimeToolsList) → whole {success,catalog} body', async () => {
        const flat = { success: true, catalog: { tools: [] } };
        const c = runtimeClient(mockFetch(flat));
        expect(await c.get('/runtime/tools', undefined, { operationId: 'runtimeToolsList' })).toEqual(flat);
    });

    // resolveFlowCallback is an ENVELOPE op: it answers `{success, data: FlowCallback}`, not a
    // flat `{success, message}` ack. The flat class is exercised above by
    // `runtimeConversationSend` and `runtimeToolsList`, both of which really are flat.
    it('envelope op (resolveFlowCallback) → unwrapped FlowCallback', async () => {
        const callback = { id: 'cb-1', status: 'completed', callback_payload: { ok: true } };
        const c = runtimeClient(mockFetch({ success: true, data: callback }));
        expect(await c.patch('/runtime/flows/callbacks/x', {}, { operationId: 'resolveFlowCallback' })).toEqual(callback);
    });

    it('bare op (specSnapshot) → whole TenantContract body', async () => {
        const snapshot = { spec_hash: 'abc', contract_version: '7', entities: {} };
        const c = contractClient(mockFetch(snapshot));
        expect(await c.get('/contract/spec/snapshot', undefined, { operationId: 'specSnapshot' })).toEqual(snapshot);
    });

    it('bare op (getAuthorizationCeiling) → whole {ownerRoleNames,grants} body', async () => {
        const ceiling = { ownerRoleNames: ['owner'], grants: [] };
        const c = contractClient(mockFetch(ceiling));
        expect(await c.get('/contract/authorizations/ceiling', undefined, { operationId: 'getAuthorizationCeiling' })).toEqual(ceiling);
    });
});
