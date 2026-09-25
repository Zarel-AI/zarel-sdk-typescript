// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
import { FetchClient } from './_internal/fetch-client';
import type { FetchClientOptions, TokenInput } from './_internal/fetch-client';
import type { Interceptors } from './_internal/interceptors';
import { RUNTIME_OPERATIONS, CONTRACT_OPERATIONS } from './generated/unwrap-map';
import { RuntimeNamespace } from './runtime';
import { ContractNamespace } from './contract';

// ── Public configuration ────────────────────────────────────────────────

// The Zarel API is served under a `/v1/` prefix on each host
// (`https://{tenant}.zarel.ai/v1/`, or `https://api.zarel.ai/v1/` for the
// alias host). The rest of a tenant host serves other things, so only paths
// under `/v1/` reach the API — which is why the default base URL carries the
// prefix.
const DEFAULT_BASE_URL = 'https://api.zarel.ai/v1';

/**
 * Insert `.admin.` after the first dot in the runtime host to derive the
 * contract host. Returns `undefined` when the URL has no dotted host
 * (e.g., `http://localhost:3001/v1`).
 */
function deriveContractFromRuntime(runtimeBaseUrl: string): string | undefined {
    try {
        const u = new URL(runtimeBaseUrl);
        const host = u.host;
        const firstDot = host.indexOf('.');
        if (firstDot < 0) return undefined;
        const adminHost = `${host.slice(0, firstDot)}.admin${host.slice(firstDot)}`;
        return `${u.protocol}//${adminHost}${u.pathname}${u.search}`;
    } catch {
        return undefined;
    }
}

export interface ZarelOptions {
    /**
     * Tenant slug. When set and `runtimeBaseUrl` / `contractBaseUrl` are
     * not provided, hosts are derived as
     * `https://{tenant}.zarel.ai/v1` (runtime) and
     * `https://{tenant}.admin.zarel.ai/v1` (contract).
     */
    tenant?: string;

    /**
     * Credential for the runtime plane (`token_class: tenant`). Accepts a
     * static string OR a provider `() => string | Promise<string>` resolved
     * before each request. Required for any `client.runtime.*` call unless
     * `transportManaged` is set; when absent and not transport-managed, runtime
     * methods throw `ZarelAuthError({ code: 'runtime_token_missing' })` before
     * any network I/O.
     */
    runtimeToken?: TokenInput;

    /**
     * Credential for the contract plane (`token_class: contract`). String or
     * provider, same semantics as `runtimeToken`. When absent and not
     * transport-managed, contract methods throw
     * `ZarelAuthError({ code: 'contract_token_missing' })` before any network I/O.
     */
    contractToken?: TokenInput;

    /**
     * Transport-managed (no-token) mode for BOTH planes: a credential-injecting
     * transport (e.g. a backend proxy that holds the user's session) sets `Authorization` server-side,
     * so the SDK omits the header and skips the token-presence guard. Opt-in —
     * direct consumers keep the token-required guard.
     */
    transportManaged?: boolean;

    /**
     * Override the derived runtime baseUrl
     * (default: `https://{tenant}.zarel.ai/v1`).
     */
    runtimeBaseUrl?: string;

    /**
     * Override the derived contract baseUrl
     * (default: `https://{tenant}.admin.zarel.ai/v1`).
     */
    contractBaseUrl?: string;

    /** Request timeout in milliseconds (default: 30000). Applied to both planes. */
    timeout?: number;
    /** Maximum number of retries on 5xx / network errors (default: 3). Applied to both planes. */
    maxRetries?: number;
    /** Base retry delay in milliseconds (default: 500). Applied to both planes. */
    retryDelay?: number;
    /** Custom fetch implementation. Applied to both planes. */
    fetch?: typeof globalThis.fetch;
    /**
     * Opt-in API version. When set, every request carries
     * `X-Zarel-Api-Version: <value>`. Applied to both planes. Forward-looking —
     * no backend reads it today; unset ⇒ header omitted.
     */
    apiVersion?: string;
    /**
     * Opt-in per-attempt request/response/error interceptors. Applied to
     * both planes. `onRequest` may mutate outgoing headers (throw aborts);
     * `onResponse`/`onError` are read-only observers (throw swallowed).
     */
    interceptors?: Interceptors;
}

// ── Zarel SDK Client ────────────────────────────────────────────────────

export class Zarel {
    readonly runtime: RuntimeNamespace;
    readonly contract: ContractNamespace;

    private readonly _runtimeClient: FetchClient;
    private readonly _contractClient: FetchClient;

    constructor(options: ZarelOptions) {
        // ── Resolve runtime base URL ──────────────────────────────────
        const runtimeBaseUrl = options.runtimeBaseUrl
            ?? (options.tenant
                ? `https://${options.tenant}.zarel.ai/v1`
                : DEFAULT_BASE_URL);

        const contractBaseUrl = options.contractBaseUrl
            ?? (options.tenant
                ? `https://${options.tenant}.admin.zarel.ai/v1`
                : undefined)
            ?? deriveContractFromRuntime(runtimeBaseUrl)
            ?? runtimeBaseUrl;

        const sharedOpts = {
            ...(options.timeout !== undefined ? { timeout: options.timeout } : {}),
            ...(options.maxRetries !== undefined ? { maxRetries: options.maxRetries } : {}),
            ...(options.retryDelay !== undefined ? { retryDelay: options.retryDelay } : {}),
            ...(options.fetch !== undefined ? { fetch: options.fetch } : {}),
            ...(options.apiVersion !== undefined ? { apiVersion: options.apiVersion } : {}),
            ...(options.interceptors !== undefined ? { interceptors: options.interceptors } : {}),
        };

        const transportManaged = options.transportManaged ?? false;
        const runtimeClientOptions: FetchClientOptions = {
            baseUrl: runtimeBaseUrl,
            token: options.runtimeToken ?? '',
            requireTokenCode: 'runtime_token_missing',
            transportManaged,
            operations: RUNTIME_OPERATIONS,
            ...sharedOpts,
        };
        const contractClientOptions: FetchClientOptions = {
            baseUrl: contractBaseUrl,
            token: options.contractToken ?? '',
            requireTokenCode: 'contract_token_missing',
            transportManaged,
            operations: CONTRACT_OPERATIONS,
            ...sharedOpts,
        };

        this._runtimeClient = new FetchClient(runtimeClientOptions);
        this._contractClient = new FetchClient(contractClientOptions);

        this.runtime = new RuntimeNamespace(this._runtimeClient);
        this.contract = new ContractNamespace(this._contractClient);
    }
}
