// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// Tests for the contract-plane surface.
//
// Covers: contract.batch, contract.spec.dryRun, contract.skills,
// contract.actions, the contract-section collections, and the
// singleton documents (no `admin`/`singletons` namespace levels).

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

function callUrl(fetchFn: MockFetch, idx = 0): string {
    const c = fetchFn.mock.calls[idx];
    if (!c) throw new Error(`expected fetch call ${idx}`);
    return c[0] as string;
}
function callMethod(fetchFn: MockFetch, idx = 0): string {
    const c = fetchFn.mock.calls[idx];
    if (!c) throw new Error(`expected fetch call ${idx}`);
    return (c[1] as RequestInit).method as string;
}
function callBody(fetchFn: MockFetch, idx = 0): unknown {
    const c = fetchFn.mock.calls[idx];
    if (!c) throw new Error(`expected fetch call ${idx}`);
    const init = c[1] as RequestInit;
    return init.body ? JSON.parse(init.body as string) as unknown : undefined;
}

describe('contract.batch', () => {
    it('execute() → POST /batch with payload pass-through', async () => {
        const { zarel, fetchFn } = makeClient();
        // `operations` / `path` is the body the server accepts; a body without
        // `operations` is refused with `batch_operations_missing`.
        const payload = { operations: [{ id: '1', method: 'GET' as const, path: '/runtime/records/orders' }] };
        await zarel.contract.batch.execute(payload);
        expect(callMethod(fetchFn)).toBe('POST');
        expect(callUrl(fetchFn)).toContain('/contract/batch');
        expect(callBody(fetchFn)).toEqual(payload);
    });
});

describe('contract.spec.dryRun', () => {
    it('submit() → POST /contract/spec/dry-run', async () => {
        const { zarel, fetchFn } = makeClient();
        const body = {
            proposed_spec: 'name: tenant\n',
            replay_window: { from: '2026-05-01T00:00:00Z', to: '2026-05-22T00:00:00Z' },
        };
        await zarel.contract.spec.dryRun.submit(body);
        expect(callMethod(fetchFn)).toBe('POST');
        expect(callUrl(fetchFn)).toContain('/contract/spec/dry-run');
    });
    it('get() → GET /contract/spec/dry-run/:id', async () => {
        const { zarel, fetchFn } = makeClient();
        await zarel.contract.spec.dryRun.get('rep-1');
        expect(callMethod(fetchFn)).toBe('GET');
        expect(callUrl(fetchFn)).toContain('/contract/spec/dry-run/rep-1');
    });
    it('cancel() → DELETE /contract/spec/dry-run/:id', async () => {
        const { zarel, fetchFn } = makeClient();
        await zarel.contract.spec.dryRun.cancel('rep-1');
        expect(callMethod(fetchFn)).toBe('DELETE');
        expect(callUrl(fetchFn)).toContain('/contract/spec/dry-run/rep-1');
    });
});

describe('contract.skills CRUD', () => {
    it.each([
        ['list', 'GET', '/contract/skills'],
        ['get', 'GET', '/contract/skills/foo'],
        ['create', 'POST', '/contract/skills'],
        ['put', 'PUT', '/contract/skills/foo'],
        ['patch', 'PATCH', '/contract/skills/foo'],
        ['delete', 'DELETE', '/contract/skills/foo'],
    ] as const)('%s() → %s %s', async (verb, method, path) => {
        const { zarel, fetchFn } = makeClient();
        const ns = zarel.contract.skills;
        switch (verb) {
        case 'list': await ns.list(); break;
        case 'get': await ns.get('foo'); break;
        // The create body is derived from the published schema, so a skill needs the
        // properties the schema requires. So does a `put`, which takes the same body;
        // a `patch` needs one member to change.
        case 'create': await ns.create({
            name: 'foo', version: '1.0.0', intent_triggers: ['t'], required_entities: ['orders'],
        }); break;
        case 'put': await ns.put('foo', {
            name: 'foo', version: '1.0.0', intent_triggers: ['t'], required_entities: ['orders'],
        }); break;
        case 'patch': await ns.patch('foo', { version: '1.0.1' }); break;
        case 'delete': await ns.delete('foo'); break;
        }
        expect(callMethod(fetchFn)).toBe(method);
        expect(callUrl(fetchFn)).toContain(path);
    });
});

describe('contract.actions CRUD', () => {
    it.each([
        ['list', 'GET', '/contract/actions'],
        ['get', 'GET', '/contract/actions/approve'],
        ['create', 'POST', '/contract/actions'],
        ['put', 'PUT', '/contract/actions/approve'],
        ['patch', 'PATCH', '/contract/actions/approve'],
        ['delete', 'DELETE', '/contract/actions/approve'],
    ] as const)('%s() → %s %s', async (verb, method, path) => {
        const { zarel, fetchFn } = makeClient();
        const ns = zarel.contract.actions;
        switch (verb) {
        case 'list': await ns.list(); break;
        case 'get': await ns.get('approve'); break;
        case 'create': await ns.create({ name: 'approve', entity: 'orders', type: 'transition' }); break;
        case 'put': await ns.put('approve', { name: 'approve', entity: 'orders', type: 'transition' }); break;
        // The patch body is derived from the published action schema, so only action
        // properties compile (`risk`, for example, is not one).
        case 'patch': await ns.patch('approve', { type: 'transition' }); break;
        case 'delete': await ns.delete('approve'); break;
        }
        expect(callMethod(fetchFn)).toBe(method);
        expect(callUrl(fetchFn)).toContain(path);
    });
});

/**
 * The verbs this suite drives, typed as loosely as the drive requires and no looser.
 *
 * `delete` is `Promise<unknown>`: every contract DELETE answers `{success, data: {message}}`, and
 * this list mixes resources that return the published `ContractDeletedAck` with `events.rules`,
 * which does not declare it yet. A suite that only checks WHICH REQUEST each method issues has no
 * business pinning the response type of either.
 *
 * The write bodies stay `Record<string, unknown>` even though each resource now declares its own
 * body shape: TypeScript method parameters are BIVARIANT, so a narrower parameter still satisfies
 * this shape, and the suite drives the verbs rather than judging their bodies.
 */
interface CrudResource {
    list(): Promise<unknown>;
    get(name: string): Promise<unknown>;
    create(input: Record<string, unknown>): Promise<unknown>;
    put(name: string, input: Record<string, unknown>): Promise<unknown>;
    patch(name: string, patch: Record<string, unknown>): Promise<unknown>;
    delete(name: string): Promise<unknown>;
}

describe('contract-section collections', () => {
    const collections: Array<{ name: string; res: (z: Zarel) => CrudResource; path: string }> = [
        { name: 'capabilities', res: (z) => z.contract.capabilities, path: '/contract/capabilities' },
        { name: 'constraints', res: (z) => z.contract.constraints, path: '/contract/constraints' },
        { name: 'schemas', res: (z) => z.contract.schemas, path: '/contract/schemas' },
        { name: 'events.rules', res: (z) => z.contract.events.rules, path: '/contract/events/rules' },
    ];

    for (const { name, res, path } of collections) {
        describe(name, () => {
            it.each([
                ['list', 'GET', path],
                ['get', 'GET', `${path}/x`],
                ['create', 'POST', path],
                ['put', 'PUT', `${path}/x`],
                ['patch', 'PATCH', `${path}/x`],
                ['delete', 'DELETE', `${path}/x`],
            ] as const)('%s() → %s %s', async (verb, method, expectedPath) => {
                const { zarel, fetchFn } = makeClient();
                const r = res(zarel);
                switch (verb) {
                case 'list': await r.list(); break;
                case 'get': await r.get('x'); break;
                case 'create': await r.create({ name: 'x' }); break;
                case 'put': await r.put('x', { name: 'x' }); break;
                case 'patch': await r.patch('x', { description: 'd' }); break;
                case 'delete': await r.delete('x'); break;
                }
                expect(callMethod(fetchFn)).toBe(method);
                expect(callUrl(fetchFn)).toContain(expectedPath);
            });
        });
    }

    it('runtime.mcpServers CRUD → /contract/mcp-servers*', async () => {
        const { zarel, fetchFn } = makeClient();
        await zarel.contract.mcpServers.list();
        expect(callUrl(fetchFn, 0)).toContain('/contract/mcp-servers');
        await zarel.contract.mcpServers.get('default');
        expect(callUrl(fetchFn, 1)).toContain('/contract/mcp-servers/default');
    });

    it('runtime.mcpServers.allowedTools nested CRUD → /contract/mcp-servers/:ns/allowed-tools/*', async () => {
        const { zarel, fetchFn } = makeClient();
        const at = zarel.contract.mcpServers.allowedTools('default');
        await at.list();
        expect(callUrl(fetchFn, 0)).toContain('/contract/mcp-servers/default/allowed-tools');
        await at.get('list_tickets');
        expect(callUrl(fetchFn, 1)).toContain('/contract/mcp-servers/default/allowed-tools/list_tickets');
        await at.create({ tool_name: 'list_tickets' });
        expect(callMethod(fetchFn, 2)).toBe('POST');
        await at.put('list_tickets', { tool_name: 'list_tickets' });
        expect(callMethod(fetchFn, 3)).toBe('PUT');
        // Not `{ description: 'd' }`: an allowed tool has no `description` property, and the
        // typed body refuses it.
        await at.patch('list_tickets', { phases: { intake: true } });
        expect(callMethod(fetchFn, 4)).toBe('PATCH');
        await at.delete('list_tickets');
        expect(callMethod(fetchFn, 5)).toBe('DELETE');
    });

    it('processModel.phases CRUD → /contract/process-model/phases*', async () => {
        const { zarel, fetchFn } = makeClient();
        await zarel.contract.processModel.phases.list();
        expect(callUrl(fetchFn, 0)).toContain('/contract/process-model/phases');
        await zarel.contract.processModel.phases.get('intake');
        expect(callUrl(fetchFn, 1)).toContain('/contract/process-model/phases/intake');
    });

    it('metadata composite → /contract/metadata get/put/patch', async () => {
        const { zarel, fetchFn } = makeClient();
        await zarel.contract.metadata.get();
        expect(callMethod(fetchFn, 0)).toBe('GET');
        expect(callUrl(fetchFn, 0)).toContain('/contract/metadata');
        // `label` is written by a contract publish, not by this PUT, so it is unspellable
        // here — the line below does not compile with it, which is the assertion.
        await zarel.contract.metadata.put({ domain: 'acme.example' });
        expect(callMethod(fetchFn, 1)).toBe('PUT');
        await zarel.contract.metadata.patch({ domain: 'acme.example' });
        expect(callMethod(fetchFn, 2)).toBe('PATCH');
    });

    // The refusals, as COMPILE-TIME facts rather than round trips. Each of these keys is a
    // child resource (or, for `label`, semantic content written by a publish) that the
    // server refuses by name at runtime; the type is what stops the call being written.
    it('the treatment write body cannot name a child resource, and metadata cannot name a label', () => {
        const { zarel } = makeClient();
        // @ts-expect-error `vocabulary` belongs to /contract/treatment/vocabulary
        void (() => zarel.contract.treatment.put({ vocabulary: [] }));
        // @ts-expect-error `profiles` belongs to /contract/treatment/profiles
        void (() => zarel.contract.treatment.put({ profiles: [] }));
        // @ts-expect-error `rails` belongs to /contract/treatment/rails
        void (() => zarel.contract.treatment.patch({ rails: {} }));
        // @ts-expect-error `label` is written by a contract publish, not here
        void (() => zarel.contract.metadata.put({ label: 'Acme' }));
        // …and the shapes that ARE legal still compile.
        void (() => zarel.contract.treatment.put({ persona: 'helpful' }));
        void (() => zarel.contract.treatment.rails.put({ safety: { strip_ambiguous_language: true } }));
    });

    // A REPLACE body and a MERGE-PATCH body are different types, and the pair below is
    // what says so. `null` is the RFC 7396 removal: legal on the patch, meaningless on a replace
    // that carries the whole document. The server answers such a patch with 200 and the key
    // gone.
    it('the treatment patch body admits the `null` removal and the replace body does not', () => {
        const { zarel } = makeClient();
        void (() => zarel.contract.treatment.patch({ persona: null }));
        void (() => zarel.contract.treatment.rails.patch({ safety: null }));
        // @ts-expect-error a replace carries the whole document; `null` is not one of its values
        void (() => zarel.contract.treatment.put({ persona: null }));
        // @ts-expect-error same, one resource down
        void (() => zarel.contract.treatment.rails.put({ safety: null }));
    });

    // The same pins for the three typed singleton bodies. Without them the typing is
    // unasserted and a widening to `Record<string, unknown>` would stay green.
    it('the singleton write bodies cannot name a catalog, a collection, or a misspelled key', () => {
        const { zarel } = makeClient();
        // @ts-expect-error `services` is the catalog, written by a contract publish
        void (() => zarel.contract.llm.put({ services: [] }));
        // @ts-expect-error `provider` belongs to a `services[]` entry, not the singleton
        void (() => zarel.contract.llm.put({ provider: 'gemini' }));
        // @ts-expect-error `phases` belongs to /contract/process-model/phases
        void (() => zarel.contract.processModel.put({ phases: [] }));
        // @ts-expect-error a typo is a key the body does not declare
        void (() => zarel.contract.timezone.put({ timzone: 'UTC' }));
        // …and the shapes that ARE legal still compile, including the two a PATCH adds: nothing
        // is required, and `null` is the RFC 7396 removal.
        void (() => zarel.contract.llm.put({ temperature: 0.4 }));
        void (() => zarel.contract.llm.patch({ temperature: null }));
        void (() => zarel.contract.processModel.put({ default_phase: 'intake' }));
        void (() => zarel.contract.processModel.patch({}));
        void (() => zarel.contract.timezone.put({ timezone: 'Europe/Madrid' }));
    });
});

/**
 * WHAT THIS LOOP IS ABOUT IS THE METHOD AND THE URL, not the body — but the body still has to be
 * one the server accepts, or the suite pins a call the server answers 400 for.
 *
 * EACH ROW CARRIES CLOSURES, NOT A BODY, and that is the difference between a check and a claim
 * about one. A `body` field on a shared row type has to be widened to hold five different shapes
 * — and the widening (`as never`, or `Record<string, unknown>`) erases exactly the check it was
 * added to make: `{enabled: true} as never` compiles at every accessor, which is the call this
 * loop was supposed to stop expressing. A closure is checked at its own call site against its own
 * accessor's `Write` and `Patch`, so a body its route refuses does not compile.
 */
interface SingletonRow {
    readonly path: string;
    readonly get: (z: Zarel) => Promise<unknown>;
    readonly put: (z: Zarel) => Promise<unknown>;
    readonly patch: (z: Zarel) => Promise<unknown>;
}

describe('singleton documents', () => {
    // Each body is a document its own route accepts. `/contract/treatment` and
    // `/contract/events/delivery` are still `Record<string, unknown>` on the SDK side, so theirs
    // is only what the server accepts — which is the point: this loop must not pin a call the
    // surface refuses, and for the two that ARE typed the compiler now says so.
    const rows: readonly SingletonRow[] = [
        {
            path: '/contract/process-model',
            get: (z) => z.contract.processModel.get(),
            put: (z) => z.contract.processModel.put({ default_phase: 'intake' }),
            patch: (z) => z.contract.processModel.patch({ default_phase: 'triage' }),
        },
        {
            path: '/contract/llm',
            get: (z) => z.contract.llm.get(),
            put: (z) => z.contract.llm.put({ temperature: 0.4 }),
            patch: (z) => z.contract.llm.patch({ temperature: null }),
        },
        {
            path: '/contract/treatment',
            get: (z) => z.contract.treatment.get(),
            put: (z) => z.contract.treatment.put({ persona: 'helpful' }),
            patch: (z) => z.contract.treatment.patch({ persona: null }),
        },
        {
            path: '/contract/treatment/rails',
            get: (z) => z.contract.treatment.rails.get(),
            put: (z) => z.contract.treatment.rails.put({ safety: { strip_ambiguous_language: true } }),
            patch: (z) => z.contract.treatment.rails.patch({ safety: null }),
        },
        {
            path: '/contract/events/delivery',
            get: (z) => z.contract.events.delivery.get(),
            put: (z) => z.contract.events.delivery.put({ mode: 'webhook' }),
            patch: (z) => z.contract.events.delivery.patch({ mode: 'webhook' }),
        },
    ];

    for (const row of rows) {
        it(`${row.path} get/put/patch`, async () => {
            const { zarel, fetchFn } = makeClient();
            await row.get(zarel);
            expect(callMethod(fetchFn, 0)).toBe('GET');
            expect(callUrl(fetchFn, 0)).toContain(row.path);
            await row.put(zarel);
            expect(callMethod(fetchFn, 1)).toBe('PUT');
            expect(callUrl(fetchFn, 1)).toContain(row.path);
            await row.patch(zarel);
            expect(callMethod(fetchFn, 2)).toBe('PATCH');
            expect(callUrl(fetchFn, 2)).toContain(row.path);
        });
    }
});
