// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
import { Zarel } from '../src/client';

type MockFetch = jest.Mock<Promise<Response>, [input: string | URL | Request, init?: RequestInit]>;

function createZarelWithMock(): { zarel: Zarel; fetchFn: MockFetch } {
    const fetchFn: MockFetch = jest.fn<Promise<Response>, [input: string | URL | Request, init?: RequestInit]>().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
        headers: new Headers(),
    } as Response);

    const zarel = new Zarel({
        runtimeToken: 'test-token',
        contractToken: 'test-token',
        runtimeBaseUrl: 'https://api.test.com/v1',
        contractBaseUrl: 'https://api.test.com/v1',
        maxRetries: 0,
        fetch: fetchFn,
    });

    return { zarel, fetchFn };
}

function getCallUrl(fetchFn: MockFetch, callIndex = 0): string {
    const call = fetchFn.mock.calls[callIndex];
    if (!call) {
        throw new Error(`Expected fetch call at index ${callIndex}`);
    }
    return call[0] as string;
}

function getCallMethod(fetchFn: MockFetch, callIndex = 0): string {
    const call = fetchFn.mock.calls[callIndex];
    if (!call) {
        throw new Error(`Expected fetch call at index ${callIndex}`);
    }
    return (call[1] as RequestInit).method as string;
}

function getCallBody(fetchFn: MockFetch, callIndex = 0): unknown {
    const call = fetchFn.mock.calls[callIndex];
    if (!call) {
        throw new Error(`Expected fetch call at index ${callIndex}`);
    }
    const init = call[1] as RequestInit;
    return init.body ? JSON.parse(init.body as string) as unknown : undefined;
}

describe('Resource modules — HTTP method + path', () => {
    // ── Conversation ────────────────────────────────────────────────────────────
    describe('conversation', () => {
        it('send() → POST /runtime/conversation/send', async () => {
            const { zarel, fetchFn } = createZarelWithMock();
            await zarel.runtime.conversation.send({ message: 'hello', session_key: 'cs_1' });
            expect(getCallMethod(fetchFn)).toBe('POST');
            expect(getCallUrl(fetchFn)).toContain('/runtime/conversation/send');
            expect(getCallBody(fetchFn)).toEqual({ message: 'hello', session_key: 'cs_1' });
        });

        it('sessions() → GET /runtime/conversation/sessions', async () => {
            const { zarel, fetchFn } = createZarelWithMock();
            await zarel.runtime.conversation.sessions.list();
            expect(getCallMethod(fetchFn)).toBe('GET');
            expect(getCallUrl(fetchFn)).toContain('/runtime/conversation/sessions');
        });

        it('deleteSession() → DELETE /runtime/conversation/sessions/{key}', async () => {
            const { zarel, fetchFn } = createZarelWithMock();
            await zarel.runtime.conversation.sessions.delete('session-xyz');
            expect(getCallMethod(fetchFn)).toBe('DELETE');
            expect(getCallUrl(fetchFn)).toContain('/runtime/conversation/sessions/session-xyz');
        });
    });

    // ── Tools ───────────────────────────────────────────────────────────
    describe('tools', () => {
        it('list() → GET /runtime/tools', async () => {
            const { zarel, fetchFn } = createZarelWithMock();
            await zarel.runtime.tools.list();
            expect(getCallMethod(fetchFn)).toBe('GET');
            expect(getCallUrl(fetchFn)).toContain('/runtime/tools');
        });

        it('mcp() → GET /runtime/tools/mcp/list', async () => {
            const { zarel, fetchFn } = createZarelWithMock();
            await zarel.runtime.tools.mcp();
            expect(getCallUrl(fetchFn)).toContain('/runtime/tools/mcp/list');
        });

        it('call() → POST /runtime/tools/call with payload', async () => {
            const { zarel, fetchFn } = createZarelWithMock();
            await zarel.runtime.tools.call('list_tickets', { limit: 5 });
            expect(getCallMethod(fetchFn)).toBe('POST');
            expect(getCallUrl(fetchFn)).toContain('/runtime/tools/call');
            expect(getCallBody(fetchFn)).toEqual({
                tool: 'list_tickets',
                parameters: { limit: 5 },
            });
        });
    });

    // ── Records ─────────────────────────────────────────────────────────
    describe('records', () => {
        it('list() → GET /runtime/records/{entity}', async () => {
            const { zarel, fetchFn } = createZarelWithMock();
            await zarel.runtime.records.list('tickets', { limit: 10 });
            expect(getCallUrl(fetchFn)).toContain('/runtime/records/tickets');
            expect(getCallUrl(fetchFn)).toContain('limit=10');
        });

        it('get() → GET /runtime/records/{entity}/{id}', async () => {
            const { zarel, fetchFn } = createZarelWithMock();
            await zarel.runtime.records.get('tickets', 42);
            expect(getCallUrl(fetchFn)).toContain('/runtime/records/tickets/42');
        });

        it('create() → POST /runtime/records/{entity}', async () => {
            const { zarel, fetchFn } = createZarelWithMock();
            await zarel.runtime.records.create('tickets', { title: 'Bug' });
            expect(getCallMethod(fetchFn)).toBe('POST');
            expect(getCallUrl(fetchFn)).toContain('/runtime/records/tickets');
            expect(getCallBody(fetchFn)).toEqual({ title: 'Bug' });
        });

        it('bulk() → POST /runtime/records/{entity}/bulk', async () => {
            const { zarel, fetchFn } = createZarelWithMock();
            await zarel.runtime.records.bulk('tickets', { items: [{ data: { title: 'Bug' } }], mode: 'best_effort' });
            expect(getCallMethod(fetchFn)).toBe('POST');
            expect(getCallUrl(fetchFn)).toContain('/runtime/records/tickets/bulk');
            expect(getCallBody(fetchFn)).toEqual({ items: [{ data: { title: 'Bug' } }], mode: 'best_effort' });
        });

        it('update() → PATCH /runtime/records/{entity}/{id}', async () => {
            const { zarel, fetchFn } = createZarelWithMock();
            await zarel.runtime.records.update('tickets', 42, { title: 'Fix' });
            expect(getCallMethod(fetchFn)).toBe('PATCH');
            expect(getCallUrl(fetchFn)).toContain('/runtime/records/tickets/42');
        });

        it('delete() → DELETE /runtime/records/{entity}/{id}', async () => {
            const { zarel, fetchFn } = createZarelWithMock();
            await zarel.runtime.records.delete('tickets', 42);
            expect(getCallMethod(fetchFn)).toBe('DELETE');
            expect(getCallUrl(fetchFn)).toContain('/runtime/records/tickets/42');
        });
    });

    // ── State machine (timeline, transitions.* and replay)
    describe('stateMachine', () => {
        it('replay() → POST /runtime/state-machine/replay', async () => {
            const { zarel, fetchFn } = createZarelWithMock();
            const newConfig = {
                field: 'status',
                initial: 'requested',
                transitions: [
                    { from: 'requested', to: 'approved' },
                ],
            };
            await zarel.runtime.stateMachine.replay({ instance_id: 'inst-123', new_config: newConfig });
            expect(getCallMethod(fetchFn)).toBe('POST');
            expect(getCallUrl(fetchFn)).toContain('/runtime/state-machine/replay');
            expect(getCallBody(fetchFn)).toEqual({ instance_id: 'inst-123', new_config: newConfig });
        });

        it('listEvents() → GET /runtime/state-machine/events', async () => {
            const { zarel, fetchFn } = createZarelWithMock();
            await zarel.runtime.stateMachine.events.list({ entity_name: 'tickets', instance_id: 'inst-123' });
            expect(getCallUrl(fetchFn)).toContain('/runtime/state-machine/events');
            expect(getCallUrl(fetchFn)).toContain('entity_name=tickets');
            expect(getCallUrl(fetchFn)).toContain('instance_id=inst-123');
        });

        it('listPendingTransitions() → GET /runtime/state-machine/transition-requests?status=pending', async () => {
            const { zarel, fetchFn } = createZarelWithMock();
            await zarel.runtime.stateMachine.transitions.listPending({ roles: ['admin'] });
            expect(getCallUrl(fetchFn)).toContain('/runtime/state-machine/transition-requests');
            expect(getCallUrl(fetchFn)).toContain('status=pending');
            expect(getCallUrl(fetchFn)).toContain('roles=admin');
        });

        it('resolveTransitionRequest() → PATCH /runtime/state-machine/transition-requests/{id}', async () => {
            const { zarel, fetchFn } = createZarelWithMock();
            // `status`, not `decision`. The server reads `status`, `resolved_by`,
            // `resolved_at` and `decision_notes`; a body carrying none of them is refused
            // *"patch body requires at least one mutable field"*.
            await zarel.runtime.stateMachine.transitions.resolve('apr-001', { status: 'approved' });
            expect(getCallMethod(fetchFn)).toBe('PATCH');
            expect(getCallUrl(fetchFn)).toContain('/runtime/state-machine/transition-requests/apr-001');
            expect(getCallBody(fetchFn)).toEqual({ status: 'approved' });
        });
    });

    // ── Entities ────────────────────────────────────────────────────────
    describe('entities', () => {
        it('list() → GET /entities', async () => {
            const { zarel, fetchFn } = createZarelWithMock();
            await zarel.contract.entities.list();
            expect(getCallUrl(fetchFn)).toContain('/entities');
        });

        it('create() → POST /entities', async () => {
            const { zarel, fetchFn } = createZarelWithMock();
            await zarel.contract.entities.create({ name: 'tickets' });
            expect(getCallMethod(fetchFn)).toBe('POST');
        });

        it('fields("name").create() → POST /contract/entities/{name}/fields', async () => {
            const { zarel, fetchFn } = createZarelWithMock();
            await zarel.contract.entities.fields('tickets').create({ name: 'title', field_type: 'string' });
            expect(getCallUrl(fetchFn)).toContain('/contract/entities/tickets/fields');
        });

        // recompute lives on the runtime plane — it rewrites
        // runtime.records, unlike the entity AUTHORING verbs above.
        it('runtime.entities.recompute() → POST /runtime/entities/{name}/recompute', async () => {
            const { zarel, fetchFn } = createZarelWithMock();
            await zarel.runtime.entities.recompute('tickets');
            expect(getCallUrl(fetchFn)).toContain('/runtime/entities/tickets/recompute');
        });
    });

    // ── Spec ────────────────────────────────────────────────────────────
    describe('spec', () => {
        it('publish() → POST /contract/spec/publish', async () => {
            const { zarel, fetchFn } = createZarelWithMock();
            await zarel.contract.spec.publish({
                files: { structural: 'spec_version: "1.0"' },
                mode: 'upsert',
            });
            expect(getCallMethod(fetchFn)).toBe('POST');
            expect(getCallUrl(fetchFn)).toContain('/contract/spec/publish');
        });

        it('diff() → POST /contract/spec/diff', async () => {
            const { zarel, fetchFn } = createZarelWithMock();
            await zarel.contract.spec.diff({ proposed_spec: 'spec_version: "1.0"' });
            expect(getCallMethod(fetchFn)).toBe('POST');
            expect(getCallUrl(fetchFn)).toContain('/contract/spec/diff');
        });

        it('apply() → POST /contract/spec/apply', async () => {
            const { zarel, fetchFn } = createZarelWithMock();
            await zarel.contract.spec.apply({
                files: { structural: 'spec_version: "1.0"' },
                mode: 'replace',
            });
            expect(getCallMethod(fetchFn)).toBe('POST');
            expect(getCallUrl(fetchFn)).toContain('/contract/spec/apply');
        });

        it('snapshot() → GET /contract/spec/snapshot', async () => {
            const { zarel, fetchFn } = createZarelWithMock();
            await zarel.contract.spec.snapshot.get();
            expect(getCallMethod(fetchFn)).toBe('GET');
            expect(getCallUrl(fetchFn)).toContain('/contract/spec/snapshot');
        });

        it('snapshot() preserves the flat contract body (no `.data` unwrap → no {} erasure)', async () => {
            // The endpoint returns the flat TenantContract directly, NOT a
            // {success,data} envelope. The SDK must use the response as-is —
            // reading `.data` off it yields {} and erases entities/roles for
            // every consumer.
            const fetchFn = jest.fn<Promise<Response>, [input: string | URL | Request, init?: RequestInit]>().mockResolvedValue({
                ok: true,
                status: 200,
                json: () => Promise.resolve({
                    tenant_name: 't',
                    contract_version: 5,
                    entities: [{ name: 'clients', fields: [] }],
                    roles: [{ name: 'admin' }],
                }),
                headers: new Headers(),
            } as Response);
            const zarel = new Zarel({
                runtimeToken: 'test-token', contractToken: 'test-token',
                runtimeBaseUrl: 'https://api.test.com/v1', contractBaseUrl: 'https://api.test.com/v1',
                maxRetries: 0, fetch: fetchFn,
            });

            const snap = await zarel.contract.spec.snapshot.get();
            const contract = snap.contract as { entities?: unknown[]; roles?: unknown[] };
            expect(Array.isArray(contract.entities)).toBe(true);
            expect(contract.entities).toHaveLength(1);
            expect(contract.roles).toHaveLength(1);
            expect(snap.contract_version).toBe(5);
        });
    });

    // ── Role Assignments (resource-shaped; replaces Roles.assign/revoke)
    describe('roleAssignments', () => {
        it('create() → POST /runtime/roles/assignments', async () => {
            const { zarel, fetchFn } = createZarelWithMock();
            await zarel.runtime.roles.assignments.create({ target_user_name: 'alice', role_name: 'admin' });
            expect(getCallMethod(fetchFn)).toBe('POST');
            expect(getCallUrl(fetchFn)).toContain('/runtime/roles/assignments');
        });

        it('delete() → DELETE /runtime/roles/assignments/{user}/{role}', async () => {
            const { zarel, fetchFn } = createZarelWithMock();
            await zarel.runtime.roles.assignments.delete('alice', 'admin');
            expect(getCallMethod(fetchFn)).toBe('DELETE');
            expect(getCallUrl(fetchFn)).toContain('/runtime/roles/assignments/alice/admin');
        });
    });

    // ── Imports ─────────────────────────────────────────────────────────
    describe('imports', () => {
        it('snapshot() → POST /runtime/imports/snapshot', async () => {
            const { zarel, fetchFn } = createZarelWithMock();
            await zarel.runtime.imports.snapshot({
                data: { metadata: { format_version: '1.0', tenant: 'support' }, users: [], records: {} },
            });
            expect(getCallMethod(fetchFn)).toBe('POST');
            expect(getCallUrl(fetchFn)).toContain('/runtime/imports/snapshot');
        });

    });

    // ── Events ──────────────────────────────────────────────────────────
    describe('events', () => {
        it('subscribe() → POST /runtime/events/subscriptions', async () => {
            const { zarel, fetchFn } = createZarelWithMock();
            await zarel.runtime.events.subscriptions.create({ event_name: 'ticket.created', webhook_url: 'https://hook.io/x' });
            expect(getCallMethod(fetchFn)).toBe('POST');
            expect(getCallUrl(fetchFn)).toContain('/runtime/events/subscriptions');
        });

        it('listSubscriptions() → GET /runtime/events/subscriptions', async () => {
            const { zarel, fetchFn } = createZarelWithMock();
            await zarel.runtime.events.subscriptions.list();
            expect(getCallUrl(fetchFn)).toContain('/runtime/events/subscriptions');
        });

        it('deleteSubscription() → DELETE /runtime/events/subscriptions/{id}', async () => {
            const { zarel, fetchFn } = createZarelWithMock();
            await zarel.runtime.events.subscriptions.delete('sub-123');
            expect(getCallMethod(fetchFn)).toBe('DELETE');
            expect(getCallUrl(fetchFn)).toContain('/runtime/events/subscriptions/sub-123');
        });
    });
});
