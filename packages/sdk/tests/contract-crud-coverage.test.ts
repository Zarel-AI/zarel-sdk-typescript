// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// Contract-coverage audit.
//
// Pins the exact HTTP method + pathname of 24 contract operations exposed by
// `client.contract.*`. A reflective walk over the namespace proves coverage
// behaviorally; this file is the human-readable, per-method regression guard that
// structural walk can't be read as.

import { Zarel } from '../src/client';

type MockFetch = jest.Mock<Promise<Response>, [input: string | URL | Request, init?: RequestInit]>;

function okFetch(): MockFetch {
    return jest.fn<Promise<Response>, [input: string | URL | Request, init?: RequestInit]>().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, data: null }),
        headers: new Headers({ 'content-type': 'application/json' }),
    } as Response);
}

function call(f: MockFetch, i = 0): { method: string; path: string; body: unknown } {
    const [url, init] = f.mock.calls[i] as [string, RequestInit];
    return {
        method: (init?.method ?? 'GET').toUpperCase(),
        path: new URL(url).pathname,
        body: init?.body ? JSON.parse(init.body as string) : undefined,
    };
}

function zarel(f: MockFetch): Zarel {
    return new Zarel({ tenant: 'acme', contractToken: 'ct', fetch: f });
}

/**
 * A REPLACE STATES EVERY MUTABLE PROPERTY, so these two bodies are complete rather than illustrative.
 *
 * `PUT` requires every mutable property because no read on the `/contract/entities*` surface
 * returns an entity's `checks` or a field's `position` and `transitions`, so clear-by-omission
 * would destroy state a caller cannot see. `null` is how a property is cleared; `is_required`,
 * `position` and `transitions` refuse `null` because they have no unset value.
 *
 * `field_type` must be a canonical field type (`ContractFieldTypeName`); anything else, such as
 * `'text'`, is refused with 400.
 */
const ENTITY_REPLACE = { display_field: null, semantic_triggers: null, tool_hints: null, checks: null, default_sort: null };
const FIELD_REPLACE = {
    is_required: false, default_value: null, config: null, options: null, references: null,
    display_field: null, constraints: null, compute: null, transitions: [], binding: null, position: 0,
};

describe('contract-coverage audit — 24 contract operations', () => {
    describe('entity replace + fields (list/get/put)', () => {
        it('entities.put → PUT /v1/contract/entities/{entity}', async () => {
            const f = okFetch();
            await zarel(f).contract.entities.put('orders', { name: 'orders', ...ENTITY_REPLACE });
            expect(call(f)).toMatchObject({ method: 'PUT', path: '/v1/contract/entities/orders' });
        });
        it('entities.fields(e).list → GET /v1/contract/entities/{entity}/fields', async () => {
            const f = okFetch();
            await zarel(f).contract.entities.fields('orders').list();
            expect(call(f)).toMatchObject({ method: 'GET', path: '/v1/contract/entities/orders/fields' });
        });
        it('entities.fields(e).get → GET /v1/contract/entities/{entity}/fields/{field}', async () => {
            const f = okFetch();
            await zarel(f).contract.entities.fields('orders').get('status');
            expect(call(f)).toMatchObject({ method: 'GET', path: '/v1/contract/entities/orders/fields/status' });
        });
        it('entities.fields(e).put → PUT /v1/contract/entities/{entity}/fields/{field}', async () => {
            const f = okFetch();
            await zarel(f).contract.entities.fields('orders').put('status', { name: 'status', field_type: 'string', ...FIELD_REPLACE });
            expect(call(f)).toMatchObject({ method: 'PUT', path: '/v1/contract/entities/orders/fields/status' });
        });
    });

    describe('field transitions — entities.fields(e).transitions(field).*', () => {
        const tx = (f: MockFetch) => zarel(f).contract.entities.fields('orders').transitions('status');
        it('list → GET …/transitions', async () => {
            const f = okFetch();
            await tx(f).list();
            expect(call(f)).toMatchObject({ method: 'GET', path: '/v1/contract/entities/orders/fields/status/transitions' });
        });
        it('get(from,to) → GET …/transitions/{from}/{to}', async () => {
            const f = okFetch();
            await tx(f).get('open', 'closed');
            expect(call(f)).toMatchObject({ method: 'GET', path: '/v1/contract/entities/orders/fields/status/transitions/open/closed' });
        });
        it('create → POST …/transitions', async () => {
            const f = okFetch();
            await tx(f).create({ from: 'open', to: 'closed' });
            expect(call(f)).toMatchObject({ method: 'POST', path: '/v1/contract/entities/orders/fields/status/transitions' });
        });
        it('put(from,to) → PUT …/transitions/{from}/{to}', async () => {
            const f = okFetch();
            // `role` is not a transition property; the body type is derived from the published
            // transition schema.
            await tx(f).put('open', 'closed', { allowed_roles: ['clerk'] });
            expect(call(f)).toMatchObject({ method: 'PUT', path: '/v1/contract/entities/orders/fields/status/transitions/open/closed' });
        });
        it('patch(from,to) → PATCH …/transitions/{from}/{to}', async () => {
            const f = okFetch();
            await tx(f).patch('open', 'closed', { allowed_roles: ['auditor'] });
            expect(call(f)).toMatchObject({ method: 'PATCH', path: '/v1/contract/entities/orders/fields/status/transitions/open/closed' });
        });
        it('delete(from,to) → DELETE …/transitions/{from}/{to}', async () => {
            const f = okFetch();
            await tx(f).delete('open', 'closed');
            expect(call(f)).toMatchObject({ method: 'DELETE', path: '/v1/contract/entities/orders/fields/status/transitions/open/closed' });
        });
    });

    describe('flow patch + steps', () => {
        it('flows.patch → PATCH /v1/contract/flows/{flow}', async () => {
            const f = okFetch();
            // NOT `{description: 'x'}`: a flow has no `description` property, and the patch
            // type refuses it by name.
            await zarel(f).contract.flows.patch('intake', { trigger: { type: 'headless' } });
            expect(call(f)).toMatchObject({ method: 'PATCH', path: '/v1/contract/flows/intake' });
        });
        const steps = (f: MockFetch) => zarel(f).contract.flows.steps('intake');
        it('steps.list → GET …/steps', async () => {
            const f = okFetch();
            await steps(f).list();
            expect(call(f)).toMatchObject({ method: 'GET', path: '/v1/contract/flows/intake/steps' });
        });
        it('steps.get → GET …/steps/{name}', async () => {
            const f = okFetch();
            await steps(f).get('collect');
            expect(call(f)).toMatchObject({ method: 'GET', path: '/v1/contract/flows/intake/steps/collect' });
        });
        it('steps.create → POST …/steps', async () => {
            const f = okFetch();
            await steps(f).create({ name: 'collect', capability: 'collect_data', position: 0 });
            expect(call(f)).toMatchObject({ method: 'POST', path: '/v1/contract/flows/intake/steps' });
        });
        it('steps.put → PUT …/steps/{name}', async () => {
            const f = okFetch();
            await steps(f).put('collect', { name: 'collect' });
            expect(call(f)).toMatchObject({ method: 'PUT', path: '/v1/contract/flows/intake/steps/collect' });
        });
        it('steps.patch → PATCH …/steps/{name}', async () => {
            const f = okFetch();
            // NOT `{label}`: a flow step has no `label` property.
            await steps(f).patch('collect', { position: 1 });
            expect(call(f)).toMatchObject({ method: 'PATCH', path: '/v1/contract/flows/intake/steps/collect' });
        });
        it('steps.delete → DELETE …/steps/{name}', async () => {
            const f = okFetch();
            await steps(f).delete('collect');
            expect(call(f)).toMatchObject({ method: 'DELETE', path: '/v1/contract/flows/intake/steps/collect' });
        });
    });

    describe('flow on-completion — segment is on-completion (hyphen)', () => {
        const oc = (f: MockFetch) => zarel(f).contract.flows.onCompletion('intake');
        it('list → GET …/on-completion', async () => {
            const f = okFetch();
            await oc(f).list();
            expect(call(f)).toMatchObject({ method: 'GET', path: '/v1/contract/flows/intake/on-completion' });
        });
        it('get → GET …/on-completion/{name}', async () => {
            const f = okFetch();
            await oc(f).get('notify');
            expect(call(f)).toMatchObject({ method: 'GET', path: '/v1/contract/flows/intake/on-completion/notify' });
        });
        it('create → POST …/on-completion', async () => {
            const f = okFetch();
            await oc(f).create({ name: 'notify', position: 0 });
            expect(call(f)).toMatchObject({ method: 'POST', path: '/v1/contract/flows/intake/on-completion' });
        });
        it('put → PUT …/on-completion/{name}', async () => {
            const f = okFetch();
            await oc(f).put('notify', { name: 'notify' });
            expect(call(f)).toMatchObject({ method: 'PUT', path: '/v1/contract/flows/intake/on-completion/notify' });
        });
        it('patch → PATCH …/on-completion/{name}', async () => {
            const f = okFetch();
            await oc(f).patch('notify', { position: 1 });
            expect(call(f)).toMatchObject({ method: 'PATCH', path: '/v1/contract/flows/intake/on-completion/notify' });
        });
        it('delete → DELETE …/on-completion/{name}', async () => {
            const f = okFetch();
            await oc(f).delete('notify');
            expect(call(f)).toMatchObject({ method: 'DELETE', path: '/v1/contract/flows/intake/on-completion/notify' });
        });
    });

    describe('role replace', () => {
        it('roles.put → PUT /v1/contract/roles/{name}', async () => {
            const f = okFetch();
            // `label` is not part of the published `RoleWrite`, and `name` here is the
            // identity ECHO `RoleWrite` accepts, not a settable property.
            await zarel(f).contract.roles.put('auditor', { name: 'auditor', auto_assign: true });
            expect(call(f)).toMatchObject({ method: 'PUT', path: '/v1/contract/roles/auditor' });
        });
    });
});
