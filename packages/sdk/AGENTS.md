# AGENTS.md — @zarel-ai/sdk

TypeScript SDK for the Zarel API. Follows the Vercel SDK
pattern: resource-based API, excellent DX, zero runtime dependencies.

## Architecture

- **`client.ts`** — Core HTTP client wrapper (fetch with retries + idempotency)
- **`auth.ts`** — Token handling
- **`errors.ts`** — Error class hierarchy (ZarelError → ZarelAPIError, ZarelAuthError)
- **`types.ts`** — All request/response types derived from OpenAPI schemas
- **`resources/`** — Resource modules: conversation, tools, records, workflows, transitions, etc.
- **`_internal/`** — fetch-client (retries, idempotency), pagination helpers

## Dependencies

None at runtime — the package has **zero** runtime dependencies.

## Key Rules

- Zero runtime dependencies — native `fetch` only (Node 18+, browser).
- All request/response types must match the published OpenAPI documents of the runtime API and the contract API (the generated types live in `src/generated/`).
- Error responses are parsed into `ZarelAPIError` with `status`, `type`, `code`, `requestId`.
- Auto-generates or forwards `X-Request-Id` on every request.
- Auto-generates `Idempotency-Key` on POST methods.
- Retries: configurable exponential backoff (default 3× on 5xx / network errors).

## Testing

Run from the package directory:

```bash
npm install
npm test
npm run build
```
