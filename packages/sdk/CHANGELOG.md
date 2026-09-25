# Changelog — `@zarel-ai/sdk`

## 0.7.0 — unreleased

MINOR AND NOT A PATCH. `UserToolCatalog.actions` keeps its type, so `tsc` says nothing about it — but `actions[]` means
something narrower than it did, and a consumer on `~0.6.0` reading this file has to be told that
taking this version changes what its buttons render. A silent behavioural break under a patch
label is the version most likely to be taken by a machine and least likely to be read.

### Changed — `CapabilityCreate` is a union with one branch per kind (a type change)

`contract.capabilities.create()` takes `CapabilityCreate`. It was one object type with `name` and
`type` required and every other key optional, so `{ name, type: 'entity_action' }` compiled, and
the server refused it with 400. It is now a union of seven object types selected by `type`. Each
one requires what the server requires for that kind: `entity_action` requires `action_ref` and
`entity`, and every other kind requires a `config` in its own shape. For example, `llm` requires
`config.prompt_template`.

A literal body the server accepts still compiles. A body the server refuses for a missing key no
longer compiles. So does code that builds the body as the old flat type and fills keys in later,
because the required keys are only known once `type` is. To type one branch, narrow it by `type`:
`Extract<CapabilityCreate, { type: 'llm' }>`.

### Changed — `SchemaCreate.definition` and `SchemaWrite.definition` are typed

Both were `{ [key: string]: unknown }`, and the server refused `{}` with 400. Both are now a
transient schema: `type: 'object'`, a required `properties` map, and optional `description` and
`required`. Each property requires a `type`. An `object` property must declare `properties`, and
an `array` property must declare `items`. The type above does not state those two rules, and the
server still refuses a body that breaks them.

**A definition read with GET no longer type-checks as a write body.** `SchemaRecord.definition`
stays `{ [key: string]: unknown }`, because a stored definition is not validated again when it is read. So
`schemas.put(name, { definition: record.definition })` compiled on 0.6 and fails with TS2322 here.
Check the shape of the value you read before you send it back, or type it yourself.

### Added — `UserToolCatalog.dispatchable_actions`

Every action the actor may DISPATCH by name through `POST /runtime/actions/:name`, exposure
irrelevant. Additive and optional: a consumer that ignores it compiles unchanged.

### Changed — what `UserToolCatalog.actions` CONTAINS (behavioural, not a type change)

`actions[]` is now the **tool surface**: an action appears only when `expose_as_mcp_tool: true`
AND the underlying `(entity, verb)` is granted. It previously carried the first *granted* action
per pair, exposure never read.

**The type is unchanged, so nothing fails to compile — and that is why it is here.** A consumer
rendering action buttons from `catalog.actions` silently loses every action a tenant declared
without `expose_as_mcp_tool: true`, and the bare `/runtime/records` surface answers
`action_required` for a verb carrying a named action — so the verb ends up with no path at all.

**Migration: read `dispatchable_actions` for anything a user may INVOKE**; read `actions` only
when you mean the MCP tool surface (the actions the server exposes as MCP tools). Guard for a server
that predates the field:

```ts
const invocable = catalog.dispatchable_actions ?? catalog.actions ?? [];
```

When an `(entity, verb)` pair carried more than one action, the catalogue could name one that is
not exposed as a tool while omitting the one that is. The two fields answer one question each now.

### Changed — `contract.skills.put()` and `.patch()` take the published bodies

Both answered `501 ENDPOINT_PLANNED` for every body on earlier servers, so their `Record<string, unknown>`
parameter described nothing. They are typed from the document now. `put(name, input)` takes the
whole declaration, the same shape `create` takes, and `patch(name, patch)` takes the members to
change. A call that compiled against the open type and sends a key the server refuses no longer
compiles.

**`put` replaces.** A list the body omits is stored empty and an omitted `mcp_tool` is removed.
To change one member and keep the rest, use `patch`.

### Fixed — `runtime.audit.evidence()` and `runtime.traces.bundle()` download on the client the SDK builds

Both threw *"FetchClient does not support binary downloads — wire `fetchRaw(path)` on your custom
client"* on every call, because the SDK's own client could not read a body that is not JSON and
no client it builds has a `fetchRaw`. They now return the `application/gzip` body as an
`ArrayBuffer`, byte for byte, with the same headers, retries and errors as any other read: a
refusal is a `ZarelAPIError` carrying `status` (a 413 for a range over the per-bundle cap) and a
401 is a `ZarelAuthError`. A custom client's `fetchRaw` is no longer consulted: a client handed
to `AuditResource` or `TracesResource` from `@zarel-ai/sdk/resources` directly now needs a
`getBinary(path, query, { operationId })` answering the body's bytes.

## 0.6.0

Published to npm; no entry was written for it, and one is not reconstructed here. Working out
what a release contained by reading its diff afterwards is a guess about intent, and this file is
meant to be quotable. Recorded as a gap so the next reader does not take the jump from 0.7.0 to
0.5.0 for a missing publish.

## 0.5.0

### Removed — `IntentType` (breaking)

The exported `IntentType` union is **gone**, and `ConversationResponse.intent_type` is now typed
`string`. A consumer importing it gets `TS2305: Module '@zarel-ai/sdk' has no exported member
'IntentType'`; the migration is to use `string`.

**It was deleted rather than corrected, because no finite list can be correct.** Two of the platform's
canonical intent families are declared as regexes, parametric over the entity and action names each
tenant writes in its own contract — `{entity_name}.{create|read|update|delete|list}` and
`action.<name>`. Any enumeration therefore omits values the platform emits the moment a tenant
declares a new entity.

Checked against the intent types the server emits, the 11-member union was wrong in both
directions: **7 members were never emitted** (`entity.read`, three
`conversation.*`, three `workflow.*`) and it **omitted 31 that did**, including both intent types
that are actually live. An exhaustive `switch` over it had dead branches for values that can never
arrive and failed to compile for values that arrive on every turn.

The package's OpenAPI-generated types already declared `intent_type: string`; the hand-written union
was a second, narrower, false list beside them.

The rule that replaces it: an intent type is a string, and no published type enumerates it.

### Also removed

`workflow.approve`, `workflow.reject` and `workflow.start` — declared in the union above and emitted
by nothing. `workflow.trigger` and `workflow.execute` remain, because running code emits them.
