# @zarel-ai/sdk

TypeScript SDK for the [Zarel](https://zarel.ai) API.

## Installation

```bash
npm install @zarel-ai/sdk
```

## Quick Start

`@zarel-ai/sdk` exposes a single `Zarel` client with two explicit plane
namespaces — `client.runtime.*` (records, tools, conversation, flows, traces,
…) and `client.contract.*` (spec, entities, roles, authorization,
capabilities, schemas, processModel, runtime config, …). Each plane targets its own host and accepts an
independent JWT.

```typescript
import { Zarel } from '@zarel-ai/sdk';

const zarel = new Zarel({
  tenant: 'acmecorp',
  runtimeToken: process.env.ZAREL_RUNTIME_TOKEN!,    // JWT class: tenant
  contractToken: process.env.ZAREL_CONTRACT_TOKEN!,  // JWT class: contract
});

// ── runtime plane (https://acmecorp.zarel.ai/v1) ────────────
const reply = await zarel.runtime.conversation.send({ message: 'List pending tickets' });
const tickets = await zarel.runtime.records.list('tickets');
await zarel.runtime.actions.dispatch('cancel_booking', { record_id: 42 });

// ── contract plane (https://acmecorp.admin.zarel.ai/v1) ─────
const diff = await zarel.contract.spec.diff(yamlSource);
await zarel.contract.entities.create({ name: 'orders' /* ... */ });
await zarel.contract.actions.patch('replace_component', { enforcement: 'advisory' });
```

Either token can be omitted if you only need one plane; touching the
other plane throws `ZarelAuthError` with a code identifying which token
is missing (`runtime_token_missing` / `contract_token_missing`). See
[Error Handling](#error-handling).

Tenant provisioning is not part of this SDK; it
operates against a tenant that already exists.

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `tenant` | `string` | — | Tenant slug; derives `runtimeBaseUrl` and `contractBaseUrl` when those are not set |
| `runtimeToken` | `string \| (() => string \| Promise<string>)` | — | Runtime-plane credential (`token_class: tenant`). A static JWT **or** a provider resolved before each request (auth-callback / refresh) |
| `contractToken` | `string \| (() => string \| Promise<string>)` | — | Contract-plane credential (`token_class: contract`); same string-or-provider shape |
| `transportManaged` | `boolean` | `false` | Transport-managed (no-token) mode for **both** planes: the SDK omits the `Authorization` header and skips the token-presence guard, leaving auth to a credential-injecting transport (e.g. a BFF proxy). Opt-in — direct consumers keep the token-required guard |
| `runtimeBaseUrl` | `string` | `https://{tenant}.zarel.ai/v1` | Override the runtime host |
| `contractBaseUrl` | `string` | `https://{tenant}.admin.zarel.ai/v1` | Override the contract host |
| `timeout` | `number` | `30000` | Request timeout (ms) — applied to both planes |
| `maxRetries` | `number` | `3` | Max retries on 5xx / network errors |
| `retryDelay` | `number` | `500` | Base retry delay (ms, exponential backoff) |
| `apiVersion` | `string` | — | When set, sends `X-Zarel-Api-Version: <value>` on every request (both planes). Forward-looking — no backend reads it yet |
| `interceptors` | `Interceptors` | — | Per-attempt request/response/error hooks (both planes). See [Interceptors](#interceptors) |
| `fetch` | `typeof fetch` | `globalThis.fetch` | Custom fetch implementation |

Every request also carries a built-in `User-Agent: @zarel-ai/sdk/<version>`
header (effective in Node; browsers drop it — `User-Agent` is a forbidden
`fetch` header).

When `tenant` is omitted and no explicit `runtimeBaseUrl` is given, the
runtime plane falls back to `https://api.zarel.ai/v1`.

## Plane Surface

### `client.runtime.*`

| Resource | Methods |
|----------|---------|
| `runtime.conversation` | `send`, `clearSession`; nested `sessions.{list, get, create, delete}`, `sessions.actions.{list}` |
| `runtime.tools` | `list`, `mcp.list`, `call`, `userCatalog` |
| `runtime.records` | `list`, `get`, `create`, `update`, `delete`, `bulk` |
| `runtime.actions` | `dispatch` |
| `runtime.stateMachine` | `listInstances`, `getInstance`, `listEvents`, `getEvent`, `listTransitionRequests`, `listPendingTransitions`, `getTransitionRequest`, `createTransitionRequest`, `resolveTransitionRequest`, `replay` |
| `runtime.flows` | `instances.{list, get}` (`list` accepts an optional `{flow}` filter), `callbacks.{resolve}` |
| `runtime.mcp` | `call(message)` — POST one MCP JSON-RPC message to `/runtime/mcp`, returns the typed `McpJsonRpcResponse` |
| `runtime.events` | `subscriptions.{list, create, delete}`, `deliveries.{list}` |
| `runtime.roles.assignments` | `list`, `create`, `delete` |
| `runtime.entities` | `recompute` (rewrites `runtime.records`; entity *authoring* is `contract.entities`) |
| `llm` | `services.{list, get}`, `credentials.{list, get, put, delete}` |
| `embeddings` | `credentials.{list, get, put, delete}` (per provider; write-only on the secret) |
| `runtime.imports` | `snapshot` |
| `runtime.traces` | `get`, `list`, `replay`, `bundle` |
| `runtime.audit` | `list(log, params?)` — paginated, filterable listing of a privacy-preserving audit log (`log` ∈ `binding_violations` \| `topic_refusals`); returns a `PagePromise` (`await` → one page, `for await` → auto-paginate). `evidence(log, { from?, to? })` — download a signed tamper-evidence bundle (`.tar.gz`) for an event hash-chain (`log` ∈ `state_machine` \| `flows`) for offline `zarel verify`; optional inclusive `seq` range bounds a large log (over-cap → HTTP 413) |
| `runtime.receipts` | `list(params?)` — the AUTHENTICATED caller's OWN governance receipts, normalized over the three audit signals (`refusal` \| `binding_violation` \| `validation_violation`); always scoped server-side to the token actor (no `view_traces`), returns a `PagePromise` (`await` → one page, `for await` → auto-paginate). Filter by `signal` / `trace_id` / `from` / `to`. Each receipt carries only a non-reversible proof (hash + masked value), never the raw value |
| `runtime.system` | `health`, `metrics`, `apiKeys.{list, create, delete}` |
| `runtime.authorizations` | `effective` — self-scoped effective-authorizations introspection |

### `client.contract.*`

| Resource | Methods |
|----------|---------|
| `contract.spec` | `publish`, `diff`, `apply`, `snapshot.{get, localeCoverage, semanticDiff}`, `dryRun.{submit, get, cancel}` |
| `contract.entities` | `list`, `get`, `create`, `put`, `patch`, `delete`; `fields(name).{list, get, create, put, patch, delete}`; `fields(name).transitions(field).{list, get, create, put, patch, delete}` |
| `contract.roles` | `list`, `get`, `create`, `put`, `update`, `delete` (`put` = wholesale replace, `update` = partial patch) |
| `contract.flows` | `list`, `get`, `create`, `update`, `patch`, `delete`; `steps(name).{list, get, create, put, patch, delete}`; `onCompletion(name).{list, get, create, put, patch, delete}` — flow *definitions* (the `contract.flows` plane; runs live on `runtime.flows.instances`) |
| `contract.authorization` | `list(role)`, `get(role, onPath)`, `create(role, grant)`, `put(role, onPath, actions)`, `patch(role, onPath, actions)`, `del(role, onPath)` — the WHOLE authorization surface, addressed by `(role, on-path)` regardless of family. `ceiling.get()` — read-only owner/plan-envelope introspection |
| `contract.skills` | `list`, `get`, `create`, `put`, `patch`, `delete` (`put` = wholesale replace, `patch` = merge of the members it names) |
| `contract.actions` | `list`, `get`, `create`, `put`, `patch`, `delete` (DELETE may surface 501) |
| `contract.assistant` | `createSession`, `conversationSend`, `getChangeset`, `applyChangeset`, `discardChangeset` — conversational authoring (conversation stages into one changeset; `applyChangeset({base_hash})` is the sole mutation, one version bump). On staleness `applyChangeset` throws `ZarelAPIError` with `code:'contract_hash_mismatch'` and `details.{reseeded_changeset_id, base_hash}` |
| `contract.batch` | `execute` (Microsoft Graph-style envelope) |
| `contract.capabilities` | `list`, `get`, `create`, `put`, `patch`, `delete` |
| `contract.constraints` | same |
| `contract.schemas` | same |
| `contract.metadata` | `get`, `put`, `patch` (composite singleton) |
| `contract.events.rules` | CRUD on `/contract/events/rules*` |
| `contract.processModel` | `get`/`put`/`patch` (the process-model document) + `phases.{list,get,create,put,patch,delete}` |
| `contract.quotas` | **no resource, by design.** The per-role bounds (`max_chained_actions_per_turn`, `composite_write.*`) have no admin route — they are declared by publishing the contract, so there is nothing for the SDK to call |
| `contract.{llm,embeddings,treatment,rails,channels,mcpServers,profiles,timezone}` | Contract root sections (admin host). Distinct from the runtime-plane `client.runtime.*`. Singletons: `llm`, `rails`, `embeddings`, `timezone` (`get`/`put` only), `events.delivery`, `assistant` (`get`/`put`/`patch` + `vocabulary` collection). Collections: `mcpServers` (+ `allowedTools(ns)`), `profiles`, `channels` (+ `credentials`) |

_The namespace hierarchy mirrors the contract API's OpenAPI surface one-to-one._

### Working with authorization

A grant is `{ on, actions }` — the same shape the YAML contract declares, so what
you read here and what you author there are isomorphic. `on` is the **on-path**:
a config section (`entities`, `channels/credentials`) or an operational
root (`records/{entity}`, `flows/{flow}`, `llm/services/{name}`).

```typescript
// Everything a role holds, canonically ordered
const { grants } = await client.contract.authorization.list('support');

// Create-or-replace one grant (idempotent). An action is a bare string or a
// single-key attenuation carrying `fields` / `scope` / `when`.
await client.contract.authorization.put('support', 'records/orders', [
  'read',
  'list',
  { update: { fields: ['status'] } },
]);

// Merge actions into an existing grant — adds or re-attenuates, never drops
await client.contract.authorization.patch('support', 'records/orders', ['create']);

await client.contract.authorization.del('support', 'records/orders');
```

`create(role, grant)` is the create-only verb: it returns **409** when a grant on
that on-path already exists, so it and the idempotent `put` never disagree about
duplicates.

Writes are bounded by the **plan ceiling**. Two `403`s are expected
and worth handling distinctly: `ceiling_exceeded` (the grant is outside the
tenant's plan envelope) and `owner_role_protected` (the role is platform-seeded
and immutable to the tenant — this applies to `del` too, not only writes). Read
the envelope those verdicts derive from with:

```typescript
const { ownerRoleNames, grants } = await client.contract.authorization.ceiling.get();
```

Grants are **exact-match, with no parent→child inheritance**: a grant on `runtime`
never covers `channels`. Address the child explicitly.

## Responses

Methods return the **response payload directly** — the SDK never surfaces the
wire-level `{ success, data }` envelope. The transport validates the envelope
and returns its `data`; a `success: false` envelope surfaces as a
`ZarelAPIError`. The transport is the only place the envelope is unwrapped.

```typescript
const roles = await zarel.contract.roles.list();   // RoleRecord[]  (not { success, data })
const order = await zarel.runtime.records.get('orders', 42); // RecordData
```

A handful of endpoints return a **bare body** (no envelope) or a **flat**
shape where `success` is a status field rather than a wrapper — e.g.
`contract.spec.snapshot.get` (the flat contract document), `runtime.conversation.send`
(`{ success, message, intent_type, … }`), `runtime.tools.*`, and
`runtime.flows.callbacks.resolve`. The SDK returns those **unchanged**.

The unwrap decision is **spec-derived, not guessed**: the OpenAPI is the single
source of truth. A code generator reads each operation's
success response and emits a checked-in per-plane map
(`src/generated/unwrap-map.ts`) of `{ [operationId]: { unwrap } }`; the transport
does an O(1) lookup by the `operationId` the resource passes. An operation whose
2xx response references the canonical envelope is unwrapped to `data`; a flat or
bare response is returned whole. There is **no runtime key-shape heuristic and no
manual opt-outs**. A build-time completeness guard ensures every operation is
classified, so the decision can never silently fall through. Callers never think
about this — the return type is always the payload.

Response payload types are **generated from the Zarel API's OpenAPI documents**: the
types (`src/generated/{runtime,contract}.ts`) and the unwrap map are generated from
the same response-schema signal and checked in.

## Pagination

The paginated list calls — `runtime.records.list`, `runtime.traces.list`,
`runtime.conversation.sessions.list`, and `runtime.audit.list` — return a value that is
**both awaitable and async-iterable** (the OpenAI/Stripe pattern):

```typescript
// Await it for the first page — exactly the shape it has always returned:
const page = await zarel.runtime.records.list('orders', { limit: 50 });
console.log(page.records, page.total);

// …or iterate it to auto-paginate over every item across all pages:
for await (const order of zarel.runtime.records.list('orders', { filters: { status: 'open' } })) {
    process(order);
}
for await (const trace of zarel.runtime.traces.list({ outcome: 'refused' })) { /* … */ }
for await (const session of zarel.runtime.conversation.sessions.list({ status: 'active' })) { /* … */ }

// Audit logs (gated by the `view_traces` runtime-system action):
const violations = await zarel.runtime.audit.list('binding_violations', { entity: 'Account' });
for await (const refusal of zarel.runtime.audit.list('topic_refusals', { category: 'investment_advice' })) { /* … */ }
```

`await` is fully backward-compatible — it resolves to the same single-page shape
as before (`{ records, total }`, `{ traces, next_cursor }`, or
`ConversationSessionSummary[]`). The first page is fetched lazily (nothing happens until
you `await` or iterate) and is shared if you do both.

**Page size.** Iteration uses your `limit` as the page size; if you omit it, the
server's natural page size is used (the SDK does not inject a default, so the
first request stays identical to a plain `list` call).

**Stopping early & cancellation.** `break` out of the loop and no further page is
requested. To cancel an in-flight request, pass an `AbortSignal`:

```typescript
const ac = new AbortController();
for await (const order of zarel.runtime.records.list('orders', undefined, { signal: ac.signal })) {
    if (done) { ac.abort(); break; }
}
```

**Caveat — `conversation.sessions.list`.** That endpoint's wire shape carries neither a
`total` nor a cursor, so iteration stops when a page returns fewer items than the
page size. When the session count is an exact multiple of the page size, one extra
request returns an empty page and iteration then stops — no items are missed or
duplicated.

## Error Handling

```typescript
import { ZarelAPIError, ZarelAuthError, ZarelTimeoutError } from '@zarel-ai/sdk';

try {
  await zarel.runtime.records.list('tickets');
} catch (err) {
  if (err instanceof ZarelAuthError) {
    // Three discrete codes, distinguishable without parsing messages:
    //   'runtime_token_missing'  — runtime call without runtimeToken (pre-network)
    //   'contract_token_missing' — contract call without contractToken (pre-network)
    //   'unauthorized'           — server returned 401
    switch (err.code) {
      case 'runtime_token_missing': /* configure runtimeToken */ break;
      case 'contract_token_missing': /* configure contractToken */ break;
      case 'unauthorized': /* refresh / re-mint */ break;
    }
  }
  if (err instanceof ZarelAPIError) {
    console.error(`API Error ${err.status}: [${err.code}] ${err.message}`);
  }
  if (err instanceof ZarelTimeoutError) {
    console.error('Request timed out');
  }
}
```

## Retries

The SDK automatically retries on `408`, `429`, `500`, `502`, `503`, `504`
status codes and network errors using exponential backoff with jitter.
`401` immediately throws `ZarelAuthError` (no retry); `400` / `403` /
`404` / `501` surface as `ZarelAPIError` without retry.

**`Retry-After`** — when a retryable response (typically `429` / `503`) carries
a `Retry-After` header, the SDK honours it for that attempt's wait instead of the
exponential backoff. Both RFC 7231 forms are parsed (delta-seconds and an
HTTP-date); the wait is clamped to a 60-second ceiling so a huge value can't hang
the client (it still retries). When the header is absent or unparseable, the
exponential backoff is unchanged.

## Interceptors

Register per-attempt hooks at client construction (applied to both planes) to
observe and augment requests without replacing the transport:

```ts
const client = new Zarel({
    tenant: 'my_application',
    runtimeToken: token,
    interceptors: {
        onRequest: (ctx) => { ctx.headers['X-Trace-Id'] = traceId(); }, // mutate in place
        onResponse: (ctx) => log.debug(ctx.method, ctx.url, ctx.status, ctx.attempt),
        onError: (ctx) => log.warn('transport failure', ctx.url, ctx.attempt, ctx.error),
    },
});
```

- Hooks fire **once per network attempt** (retries included); `ctx.attempt` is
  the 0-based attempt number.
- **`onRequest`** runs after the transport assembles the per-attempt headers
  (`Authorization`, `Idempotency-Key`, `User-Agent`, `X-Zarel-Api-Version`), so it
  sees and may override any of them by mutating `ctx.headers`. A **throw aborts**
  the request (no network call, no retry) — useful as a pre-flight veto. (Avoid
  changing `Idempotency-Key` across attempts — it breaks server-side dedup.)
  Note: `ctx.headers` includes the `Authorization` bearer — don't log it.
- **`onResponse`** fires for **every** HTTP response (any status: 2xx/4xx/5xx),
  read-only. **`onError`** fires only when an attempt produced **no** response (a
  network error or timeout), read-only. The two are mutually exclusive per attempt
  and a thrown observation hook is swallowed (it never masks the real outcome).
- Hooks may be `async`; the transport awaits them. Zero runtime dependencies.

## Streaming

`client.runtime.events.stream(...)` opens a typed Server-Sent-Events stream over
`GET /runtime/events/stream` (runtime plane). It is built on native `fetch` +
`ReadableStream` (so it carries the `Authorization` header for direct consumers
and credentials for proxy/cookie consumers — unlike a raw `EventSource`) and adds
**zero runtime dependencies**.

```ts
const handle = client.runtime.events.stream(
    {
        onEvent: (e) => {
            if (e.event === 'conversation.turn_created') {
                // typed via the exported `isConversationTurnCreatedEvent` guard
                console.log(e.data.payload.session_key, e.data.payload.turn_number);
            }
        },
        onError: (err) => console.error('stream ended', err),  // terminal only
        onOpen: () => console.log('connected'),                // each (re)connect
    },
    { reconnect: true /* default */ },
);

// later — tears down the request + stops reconnecting (idempotent):
handle.close();
```

Events are a typed union: a validated `conversation.turn_created` arm plus a generic
`{ event: string; data: unknown }` fallback for other named events. Narrow with the
exported `isConversationTurnCreatedEvent(e)` guard. Malformed or schema-failing frames are
dropped (never thrown into `onEvent`).

**Reconnection** is built in and default-on: a transient disconnect (network error,
server EOF, `5xx`, `408`, `429`) reconnects with bounded exponential backoff +
`Last-Event-ID`, indefinitely until `close()`/abort. A terminal status (`401`/`403`
and other `4xx`) calls `onError` once and stops. Pass `{ reconnect: false }` for a
single connection, `{ signal }` to abort via an `AbortSignal`, or `{ lastEventId }`
to resume from a known position.

### `events.iterate(...)` — async-iterable view

For a pull-style consumer, `client.runtime.events.iterate(...)` returns an
`AsyncIterableIterator<RuntimeStreamEvent>` over the **same** stream (same auth,
reconnect, and parsing — it adds no transport of its own):

```ts
const ac = new AbortController();
for await (const e of client.runtime.events.iterate({
    signal: ac.signal,
    bufferSize: 512,                                  // default 1024; < 1 clamps to 1
    onDropped: (n) => console.warn(`dropped ${n} (slow consumer)`),
})) {
    if (isConversationTurnCreatedEvent(e)) console.log(e.data.payload.turn_number);
    if (done(e)) break;                               // break tears the stream down
}
```

Events are buffered between the stream and your loop in a **bounded FIFO** ring of
`bufferSize`. If you consume slower than events arrive and the buffer fills, the
**oldest** event is dropped (loss-tolerant, like the callback stream) and `onDropped`
is called with the running total — so memory stays bounded regardless of consumer
speed. A **terminal** stream error (e.g. `401`) is thrown out of the `for await`
(buffered events drain first); a transient disconnect reconnects silently and never
ends the loop. `break`/`return`/`throw` and an aborted `signal` all tear the
underlying stream down. `iterate` does not take `onOpen` (use `stream` for per-connect
signals); `signal`/`reconnect`/`lastEventId` apply identically.

## MCP transport (`runtime.mcp.call`)

`client.runtime.mcp.call(message)` sends one MCP JSON-RPC message to the tenant's
stateless MCP "Streamable HTTP" transport (`POST /runtime/mcp`, runtime plane) and
returns the typed `McpJsonRpcResponse`. It accepts either an `application/json` body
or a single `text/event-stream` frame (the server chooses) and de-frames both —
bare JSON-RPC, never the `{success,data}` envelope. A **protocol-level** JSON-RPC
error is returned in the union (not thrown); **transport** failures throw
(`ZarelAuthError` on 401, `ZarelAPIError` otherwise). It makes a single attempt
(no retry — `tools/call` may be a non-idempotent mutation).

```ts
const res = await client.runtime.mcp.call({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
if ('error' in res) console.error(res.error.code, res.error.message);
else console.log(res.result);
```

This is a thin, zero-dependency one-shot call — for a full MCP client (sessions,
server-push) use `@modelcontextprotocol/sdk`.

## Requirements

- Node.js 18+ (for native `fetch`)
- TypeScript 5.0+ (for type-safe usage)

## License

MIT
