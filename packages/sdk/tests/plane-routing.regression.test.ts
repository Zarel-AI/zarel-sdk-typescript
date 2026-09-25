// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// Plane-routing regression (the anti-desync guard).
//
// Walks SDK resource methods and asserts each one targets the CORRECT plane
// (host) AND builds the canonical path prefix for that plane. A substring check
// such as `toContain('/entities/...')` matches BOTH `/entities` and
// `/contract/entities`, so it cannot catch a missing prefix; this asserts the
// pathname *starts with* the plane prefix. Breaking any resource's plane/prefix
// turns this red.

import { Zarel } from '../src/client';
import {
    makeRecordingClient,
    callUrl,
    RUNTIME_BASE,
    CONTRACT_BASE,
    type MockFetch,
} from './_helpers/record-fetch';

const RUNTIME_ORIGIN = new URL(RUNTIME_BASE).origin;
const CONTRACT_ORIGIN = new URL(CONTRACT_BASE).origin;

function expectRuntime(fetchFn: MockFetch, prefix: string): void {
    const url = callUrl(fetchFn);
    expect(url.origin).toBe(RUNTIME_ORIGIN);
    expect(url.pathname.startsWith(`/v1${prefix}`)).toBe(true);
}

function expectContract(fetchFn: MockFetch, prefix: string): void {
    const url = callUrl(fetchFn);
    expect(url.origin).toBe(CONTRACT_ORIGIN);
    expect(url.pathname.startsWith(`/v1${prefix}`)).toBe(true);
}

type Call = (z: Zarel) => Promise<unknown>;

describe('plane-routing regression — runtime namespace → /runtime/* (or infra)', () => {
    const cases: ReadonlyArray<[name: string, prefix: string, call: Call]> = [
        ['records.list', '/runtime/records/', (z) => z.runtime.records.list('orders')],
        // recompute rewrites runtime.records — runtime plane, not contract.
        ['entities.recompute', '/runtime/entities/', (z) => z.runtime.entities.recompute('orders')],
        ['conversation.send', '/runtime/conversation/', (z) => z.runtime.conversation.send({ message: 'hi', session_key: 'cs_1' })],
        ['tools.list', '/runtime/tools', (z) => z.runtime.tools.list()],
        ['tools.mcp', '/runtime/tools/mcp', (z) => z.runtime.tools.mcp()],
        ['flows.instances.list', '/runtime/flows/', (z) => z.runtime.flows.instances.list()],
        ['stateMachine.events.list', '/runtime/state-machine/', (z) => z.runtime.stateMachine.events.list()],
        ['events.subscriptions.list', '/runtime/events/', (z) => z.runtime.events.subscriptions.list()],
        ['events.deliveries.list', '/runtime/events/', (z) => z.runtime.events.deliveries.list()],
        ['roles.assignments.create', '/runtime/roles/assignments', (z) => z.runtime.roles.assignments.create({ target_user_name: 'a', role_name: 'r' })],
        ['llm.services.list', '/runtime/llm/', (z) => z.runtime.llm.services.list({ scope: 'runtime' })],
        ['imports.snapshot', '/runtime/imports/', (z) => z.runtime.imports.snapshot({ data: { metadata: { format_version: '1.0', tenant: 't' }, users: [], records: {} } } as never)],
        ['authorizations.effective', '/runtime/authorizations/effective', (z) => z.runtime.authorizations.effective()],
        ['actions.dispatch', '/runtime/actions/', (z) => z.runtime.actions.dispatch('do_thing', {})],
        // mcp.call uses the dedicated postMcp transport; the shared recording
        // mock returns an envelope body (not JSON-RPC) and lacks `.text()`, so the
        // body-parse rejects — but the fetch (and thus the URL we assert) is
        // already issued. Swallow the rejection: this test verifies routing only.
        ['mcp.call', '/runtime/mcp', (z) => z.runtime.mcp.call({ jsonrpc: '2.0', method: 'ping' }).catch(() => undefined)],
    ];

    it.each(cases)('runtime.%s → %s', async (_name, prefix, call) => {
        const { zarel, fetchFn } = makeRecordingClient();
        await call(zarel);
        expectRuntime(fetchFn, prefix);
    });
});

/** A flow body the published flow schema accepts — see the note at `flows.create` below. */
const FLOW = {
    name: 'onboarding',
    trigger: { type: 'headless' as const },
    steps: [{ name: 'only_step', capability: 'noop', input: {} }],
};

describe('plane-routing regression — contract namespace → /contract/*', () => {
    const cases: ReadonlyArray<[name: string, prefix: string, call: Call]> = [
        ['entities.list', '/contract/entities', (z) => z.contract.entities.list()],
        ['entities.get', '/contract/entities/', (z) => z.contract.entities.get('orders')],
        ['entities.fields.create', '/contract/entities/', (z) => z.contract.entities.fields('orders').create({ name: 'title', field_type: 'string' })],
        ['entities.fields.patch', '/contract/entities/', (z) => z.contract.entities.fields('orders').patch('title', {})],
        ['entities.fields.delete', '/contract/entities/', (z) => z.contract.entities.fields('orders').delete('title')],
        ['roles.list', '/contract/roles', (z) => z.contract.roles.list()],
        ['skills.list', '/contract/skills', (z) => z.contract.skills.list()],
        ['flows.list', '/contract/flows', (z) => z.contract.flows.list()],
        ['flows.get', '/contract/flows/', (z) => z.contract.flows.get('onboarding')],
        // A WHOLE flow, because `ContractFlowInput` is derived from the published body and
        // `{name}` alone is not one. This suite asserts which HOST a call lands on, but a
        // placeholder body the server would refuse is a fixture that says the routing works
        // for a request nobody can make.
        ['flows.create', '/contract/flows', (z) => z.contract.flows.create(FLOW)],
        ['flows.update', '/contract/flows/', (z) => z.contract.flows.update('onboarding', FLOW)],
        ['flows.delete', '/contract/flows/', (z) => z.contract.flows.delete('onboarding')],
        ['spec.snapshot', '/contract/spec/', (z) => z.contract.spec.snapshot.get()],
        // Path-addressed authorization grants.
        ['authorization.get', '/contract/authorization/', (z) => z.contract.authorization.get('admin', 'entities')],
    ];

    it.each(cases)('contract.%s → %s', async (_name, prefix, call) => {
        const { zarel, fetchFn } = makeRecordingClient();
        await call(zarel);
        expectContract(fetchFn, prefix);
    });
});

describe('plane-routing regression — documented exceptions', () => {
    // api-keys methods on the runtime-bound SystemResource build `/api-keys`
    // (no `/runtime/` prefix, contract-plane in spirit). No endpoint serves them
    // today. Asserted here so the exception is DOCUMENTED, not silently skipped — if anyone "fixes" the
    // plane later it should be a deliberate change to this assertion.
    it('system.listApiKeys builds /api-keys (known exception, not /runtime/*)', async () => {
        const { zarel, fetchFn } = makeRecordingClient();
        await zarel.runtime.system.listApiKeys();
        expect(callUrl(fetchFn).pathname).toBe('/v1/api-keys');
    });
});
