// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
import { ZarelAPIError, ZarelAuthError, ZarelError, ZarelTimeoutError } from '../errors';
import type { ErrorBody } from '../types/platform';
import type { LocaleOptions } from '../types/locale';
import type {
    EventStreamHandle,
    EventStreamHandlers,
    EventStreamOptions,
} from '../types/events-stream';
import type { McpJsonRpcRequest, McpJsonRpcResponse } from '../types/mcp';
import { resolveAuthHeaders } from './auth-headers';
import { parseConfirmationChallenge } from './confirmation';
import { parseRetryAfter } from './retry-after';
import { USER_AGENT } from './version';
import { runOnError, runOnResponse, type Interceptors } from './interceptors';
import { runEventStream, type ConnectOutcome } from './sse-client';
import { extractMcpResponse } from './mcp';

// Produce a query-record fragment from LocaleOptions.
// When `locale` is undefined the result is `{}`, so the SDK omits
// `?locale=` entirely (the server applies its own resolution chain).
export function localeQuery(options?: LocaleOptions): Record<string, string> {
    if (!options?.locale) return {};
    return { locale: options.locale };
}

// Like `localeQuery`, but `undefined` instead of `{}` when no locale is set,
// for call sites that pass no query at all in that case.
export function localeQueryOrUndefined(options?: LocaleOptions): { locale: string } | undefined {
    if (!options?.locale) return undefined;
    return { locale: options.locale };
}

// ── Public types ────────────────────────────────────────────────────────

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * A token may be a static string or a provider (sync or async) resolved before
 * each request — the common auth-callback shape, which lets a caller refresh
 * an expiring token without rebuilding the client.
 */
export type TokenInput = string | (() => string | Promise<string>);

export interface FetchClientOptions {
    baseUrl: string;
    token: TokenInput;
    timeout?: number;
    maxRetries?: number;
    retryDelay?: number;
    /** Custom fetch implementation (defaults to global fetch). */
    fetch?: typeof globalThis.fetch;
    /**
     * When set, `request()` invokes `requireToken(token, requireTokenCode)`
     * before any network I/O. The runtime and contract FetchClients set
     * this to `'runtime_token_missing'` or `'contract_token_missing'`.
     */
    requireTokenCode?: 'runtime_token_missing' | 'contract_token_missing';
    /**
     * Transport-managed (no-token) mode: a credential-injecting transport (e.g.
     * a backend proxy that holds the user's session) sets `Authorization` server-side, so this client
     * (a) SKIPS the `requireToken` presence guard and (b) OMITS the
     * `Authorization` header entirely. Opt-in only — direct consumers keep the
     * token-required guard.
     */
    transportManaged?: boolean;
    /**
     * Opt-in API version. When set, every request carries
     * `X-Zarel-Api-Version: <value>`. No backend reads it today (forward-looking);
     * unset ⇒ header omitted.
     */
    apiVersion?: string;
    /**
     * Opt-in per-attempt request/response/error interceptors. See
     * `./interceptors`. `onRequest` may mutate the outgoing headers (throw
     * aborts); `onResponse`/`onError` are read-only observers (throw swallowed).
     */
    interceptors?: Interceptors;
    /**
     * The codegen-derived envelope-unwrap map for THIS plane. Keyed by
     * `operationId`; `{unwrap:true}` ⇒ the transport validates the
     * `{success,data}` envelope and returns `data`, `{unwrap:false}` ⇒ the body
     * is returned whole. The SINGLE unwrap authority (no runtime heuristic, no
     * manual opt-outs). Injected per plane by `client.ts`
     * (`RUNTIME_OPERATIONS` / `CONTRACT_OPERATIONS`).
     */
    operations: Readonly<Record<string, { unwrap: boolean }>>;
}

export interface RequestOptions {
    method: HttpMethod;
    path: string;
    body?: unknown;
    query?: Record<string, string | number | boolean | string[] | undefined>;
    headers?: Record<string, string>;
    /** Skip automatic Idempotency-Key generation for this request. */
    skipIdempotency?: boolean;
    signal?: AbortSignal;
    /**
     * The OpenAPI `operationId` this request invokes. The
     * transport looks it up in the per-plane unwrap map to decide whether to
     * strip the `{success,data}` envelope — the SINGLE unwrap authority. An
     * `operationId` absent from the map is a fail-fast `ZarelError` (never a
     * silent `undefined`); a build-time cross-check guard makes that never fire
     * in production.
     */
    operationId: string;
    /**
     * `'arrayBuffer'` returns a successful body as its raw bytes, whatever its
     * content type, with no envelope unwrap — for the `application/gzip` evidence
     * bundles. Auth, retry and the non-2xx error mapping are the same as JSON's.
     */
    responseType?: 'json' | 'arrayBuffer';
}

/**
 * Per-call options for the convenience methods. `operationId` is REQUIRED (the
 * unwrap decision is keyed by it); `signal` is the optional `AbortSignal`.
 */
export interface CallOptions {
    operationId: string;
    signal?: AbortSignal;
    /**
     * Extra request headers for this call. Merged into the per-attempt header
     * set and re-sent on every retry. Used by the writes a `confirm` guard can
     * pause to carry `X-Zarel-Confirmation-Token`.
     */
    headers?: Record<string, string>;
}

// ── Internals ───────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 500;
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);
// Ceiling for an honoured `Retry-After` so a huge/malicious value can't hang
// the client (it still retries, just bounded).
const MAX_RETRY_AFTER_MS = 60_000;
const API_VERSION_HEADER = 'X-Zarel-Api-Version';

function generateId(): string {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
        return globalThis.crypto.randomUUID();
    }
    // Fallback for environments without crypto.randomUUID
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

function buildUrl(base: string, path: string, query?: Record<string, string | number | boolean | string[] | undefined>): string {
    // Strip leading slash so new URL() resolves path relative to base,
    // preserving all path segments in base (e.g. /v1).
    const relativePath = path.replace(/^\//, '');
    const url = new URL(relativePath, base.endsWith('/') ? base : `${base}/`);
    if (query) {
        for (const [key, value] of Object.entries(query)) {
            if (value === undefined) continue;
            if (Array.isArray(value)) {
                // Repeated query parameters (`?roles=a&roles=b`).
                for (const item of value) {
                    if (item !== undefined && item !== null) url.searchParams.append(key, String(item));
                }
            } else {
                url.searchParams.set(key, String(value));
            }
        }
    }
    return url.toString();
}

async function parseErrorBody(res: Response): Promise<ZarelAPIError> {
    let raw: unknown;
    try {
        raw = await res.json();
    } catch {
        // Response body is not JSON
    }
    const body = (raw !== null && typeof raw === 'object') ? (raw as Record<string, unknown>) : undefined;
    const error = body?.error as ErrorBody['error'] | undefined;

    if (body !== undefined && error) {
        // Preserve any non-standard top-level fields (everything except the
        // canonical `error` envelope) as `details` — e.g. the assistant apply
        // 409 `reseeded_changeset_id`/`base_hash`. Undefined when the
        // body carries only `error`.
        const details: Record<string, unknown> = {};
        for (const key of Object.keys(body)) {
            if (key !== 'error') details[key] = body[key];
        }
        // The confirmation challenge rides INSIDE the `error`
        // envelope, so `details` (which carries only what is outside it) would
        // drop it. Surfaced as its own typed field instead; parsed fail-closed,
        // so an incomplete challenge degrades to an ordinary API error rather
        // than promising a retry the client cannot make.
        const confirmation = parseConfirmationChallenge(
            (error as { confirmation?: unknown }).confirmation,
        );
        return new ZarelAPIError(
            res.status,
            error.type,
            error.code,
            error.message,
            error.request_id,
            error.field,
            Object.keys(details).length > 0 ? details : undefined,
            confirmation,
        );
    }

    return new ZarelAPIError(
        res.status,
        'unknown',
        'UNKNOWN',
        `HTTP ${res.status}: ${res.statusText}`,
        res.headers.get('x-request-id') ?? undefined,
    );
}

/** The canonical success envelope: `{success, data, message?}` and nothing else. */
interface SuccessEnvelope {
    success: boolean;
    data?: unknown;
    message?: string;
    error?: ErrorBody['error'];
}

/**
 * The single envelope-unwrap authority. Invoked ONLY
 * when the per-plane unwrap map classifies the operation `{unwrap:true}`. A valid
 * `{success,data}` envelope is unwrapped to `data`; a `success:false` envelope on
 * a 2xx response surfaces as a typed `ZarelAPIError`; a body that is NOT a valid
 * envelope (no boolean `success`) when the spec said it should be one is a
 * MALFORMED response → `ZarelError` (never a silent `undefined`). The unwrap
 * *decision* lives in the codegen map, not here.
 */
function unwrapEnvelope<T>(body: unknown, status: number, requestId: string | undefined): T {
    if (typeof body !== 'object' || body === null || typeof (body as Record<string, unknown>).success !== 'boolean') {
        throw new ZarelError(
            'malformed response: the OpenAPI marks this operation as envelope-wrapped but the body is not a {success,data} envelope',
        );
    }
    const env = body as SuccessEnvelope;
    if (env.success) {
        return env.data as T;
    }
    // success:false envelope on a 2xx response — surface as an API error.
    throw new ZarelAPIError(
        status,
        env.error?.type ?? 'unknown',
        env.error?.code ?? 'UNKNOWN',
        env.error?.message ?? env.message ?? `HTTP ${status}: request failed`,
        env.error?.request_id ?? requestId,
        env.error?.field,
    );
}

/** The optional slice of `CallOptions` every convenience method forwards verbatim. */
function callExtras(options: CallOptions): Pick<RequestOptions, 'signal' | 'headers'> {
    return {
        ...(options.signal ? { signal: options.signal } : {}),
        ...(options.headers ? { headers: options.headers } : {}),
    };
}

function createAbortError(): Error {
    const error = new Error('Request aborted');
    error.name = 'AbortError';
    return error;
}

function isAbortError(error: unknown): boolean {
    return error instanceof Error && error.name === 'AbortError';
}

function sleepWithSignal(ms: number, signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) {
        return Promise.reject(createAbortError());
    }

    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            signal?.removeEventListener('abort', onAbort);
            resolve();
        }, ms);

        const onAbort = (): void => {
            clearTimeout(timer);
            signal?.removeEventListener('abort', onAbort);
            reject(createAbortError());
        };

        signal?.addEventListener('abort', onAbort, { once: true });
    });
}

// ── FetchClient ─────────────────────────────────────────────────────────

export class FetchClient {
    private readonly baseUrl: string;
    private readonly token: TokenInput;
    private readonly transportManaged: boolean;
    private readonly timeout: number;
    private readonly maxRetries: number;
    private readonly retryDelay: number;
    private readonly fetchFn: typeof globalThis.fetch;
    private readonly requireTokenCode: FetchClientOptions['requireTokenCode'];
    private readonly apiVersion?: string;
    private readonly interceptors?: Interceptors;
    private readonly operations: Readonly<Record<string, { unwrap: boolean }>>;

    constructor(options: FetchClientOptions) {
        // Construction never throws on missing token. When
        // `requireTokenCode` is set (and not transport-managed), the per-request
        // guard throws ZarelAuthError with that code before any network I/O.
        this.baseUrl = options.baseUrl.replace(/\/+$/, '');
        this.token = options.token;
        this.transportManaged = options.transportManaged ?? false;
        this.timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;
        this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
        this.retryDelay = options.retryDelay ?? DEFAULT_RETRY_DELAY_MS;
        this.fetchFn = options.fetch ?? globalThis.fetch.bind(globalThis);
        this.requireTokenCode = options.requireTokenCode;
        this.apiVersion = options.apiVersion;
        this.interceptors = options.interceptors;
        this.operations = options.operations;
    }

    async request<T>(options: RequestOptions): Promise<T> {
        // Auth via the single shared authority: transport-managed
        // omits Authorization + skips the presence guard; otherwise it resolves
        // the token (string or provider), runs the presence guard, and yields
        // the Bearer header — all before any network I/O.
        const authHeaders = await resolveAuthHeaders(this.token, this.transportManaged, this.requireTokenCode);
        const url = buildUrl(this.baseUrl, options.path, options.query);
        // Extract caller-provided X-Request-Id (if any) before building baseHeaders.
        // It must NOT live in baseHeaders because it is set per-attempt below.
        const requestId = (options.headers?.['X-Request-Id']) ?? generateId();
        const baseHeaders: Record<string, string> = {
            'User-Agent': USER_AGENT,
            ...(this.apiVersion !== undefined ? { [API_VERSION_HEADER]: this.apiVersion } : {}),
            ...authHeaders,
            ...options.headers,
        };
        delete baseHeaders['X-Request-Id'];

        if (options.body !== undefined) {
            baseHeaders['Content-Type'] = 'application/json';
        }

        // Auto-generate Idempotency-Key for POST/PUT/PATCH unless skipped.
        // Generated once and reused across retries — this is intentional so
        // the server can deduplicate replayed mutations.
        if (
            !options.skipIdempotency &&
            ['POST', 'PUT', 'PATCH'].includes(options.method) &&
            !baseHeaders['Idempotency-Key']
        ) {
            baseHeaders['Idempotency-Key'] = generateId();
        }

        let lastError: Error | undefined;

        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            if (options.signal?.aborted) {
                throw createAbortError();
            }

            const headers: Record<string, string> = {
                ...baseHeaders,
                'X-Request-Id': requestId,
            };
            // Server-advertised retry delay for this attempt (set only when a
            // retryable response carries a parseable `Retry-After`; never on a
            // network/timeout error, which produces no response).
            let retryAfterMs: number | undefined;
            // True once this attempt received an HTTP response (any status),
            // so a POST-response throw (e.g. a malformed-JSON 2xx body) does NOT
            // also fire onError — onResponse already fired, and the two are
            // mutually exclusive per attempt.
            let responded = false;
            // onRequest runs OUTSIDE the try so its throw aborts the request
            // (propagates, no fetch, no retry) rather than being caught as a
            // retryable error. It mutates `headers` in place (last word over
            // auth/idempotency/identity, re-applied every attempt).
            if (this.interceptors?.onRequest) {
                await this.interceptors.onRequest({ method: options.method, url, headers, attempt });
            }
            try {
                const response = await this.fetchWithTimeout(url, {
                    method: options.method,
                    headers,
                    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
                }, options.signal);
                responded = true;

                // onResponse fires for EVERY HTTP response (any status),
                // before status branching. Read-only; swallowed throw.
                await runOnResponse(this.interceptors, { method: options.method, url, status: response.status, attempt });

                if (response.ok) {
                    if (options.responseType === 'arrayBuffer') {
                        return await response.arrayBuffer() as T;
                    }
                    // 204 No Content — or any ok response with no body
                    if (response.status === 204) {
                        return undefined as T;
                    }
                    const contentType = response.headers.get('content-type');
                    const contentLength = response.headers.get('content-length');
                    if (contentLength === '0') {
                        return undefined as T;
                    }
                    if (contentType !== null && !contentType.includes('application/json')) {
                        return undefined as T;
                    }
                    const parsed: unknown = await response.json();
                    // The codegen-derived per-plane map is the SINGLE unwrap
                    // authority. An unmapped operationId is a
                    // fail-fast ZarelError (never a silent undefined); the build-time
                    // cross-check guard makes that effectively never fire.
                    const op = this.operations[options.operationId];
                    if (!op) {
                        throw new ZarelError(`unmapped operation: '${options.operationId}' has no entry in the generated unwrap map`);
                    }
                    return op.unwrap ? unwrapEnvelope<T>(parsed, response.status, requestId) : (parsed as T);
                }

                // 401 → immediate auth error, no retry
                if (response.status === 401) {
                    const apiError = await parseErrorBody(response);
                    throw new ZarelAuthError(apiError.message, 'unauthorized');
                }

                // Non-retryable error → throw immediately
                if (!RETRYABLE_STATUS_CODES.has(response.status)) {
                    throw await parseErrorBody(response);
                }

                // Retryable error → store and continue loop
                lastError = await parseErrorBody(response);
                // Honour the server's `Retry-After` for this attempt's wait.
                retryAfterMs = parseRetryAfter(response.headers.get('Retry-After'), Date.now());
            } catch (error) {
                if (isAbortError(error) || options.signal?.aborted) {
                    throw createAbortError();
                }
                // Deterministic SDK errors propagate immediately (no retry):
                // ZarelAuthError, non-retryable ZarelAPIError (incl. the success:false
                // envelope), and a malformed-envelope ZarelError. Only ZarelTimeoutError
                // and network errors fall through to the retry path.
                if (error instanceof ZarelError && !(error instanceof ZarelTimeoutError)) {
                    throw error;
                }
                // Retryable: ZarelAPIError (retryable status), ZarelTimeoutError, network errors
                // onError fires ONLY for a no-response transport failure
                // (network error / timeout). HTTP error statuses already fired
                // onResponse above; aborts/deterministic errors re-threw before
                // reaching this point; and a POST-response throw (`responded`
                // already true — e.g. a malformed-JSON 2xx) must NOT fire onError
                // (onResponse covered it). Read-only; swallowed throw.
                if (!responded) {
                    await runOnError(this.interceptors, { method: options.method, url, error, attempt });
                }
                lastError = error instanceof Error ? error : new Error(String(error));
            }

            // Wait before retry. An honoured `Retry-After` (clamped to the
            // ceiling) takes precedence over the exponential backoff with jitter.
            if (attempt < this.maxRetries) {
                let delay: number;
                if (retryAfterMs !== undefined) {
                    delay = Math.min(retryAfterMs, MAX_RETRY_AFTER_MS);
                } else {
                    const backoff = this.retryDelay * Math.pow(2, attempt);
                    const jitter = Math.random() * backoff * 0.1;
                    delay = backoff + jitter;
                }
                await sleepWithSignal(delay, options.signal);
            }
        }

        throw lastError ?? new Error('Request failed after retries');
    }

    // Convenience methods. Every call MUST declare its `operationId` (the
    // per-plane unwrap map is the single unwrap authority).
    async get<T>(
        path: string,
        query: Record<string, string | number | boolean | string[] | undefined> | undefined,
        options: CallOptions,
    ): Promise<T> {
        return await this.request<T>({ method: 'GET', path, operationId: options.operationId, ...(query ? { query } : {}), ...callExtras(options) });
    }

    /** `get`, reading the successful body as raw bytes (see `RequestOptions.responseType`). */
    async getBinary(
        path: string,
        query: Record<string, string | number | boolean | string[] | undefined> | undefined,
        options: CallOptions,
    ): Promise<ArrayBuffer> {
        return await this.request<ArrayBuffer>({ method: 'GET', path, operationId: options.operationId, responseType: 'arrayBuffer', ...(query ? { query } : {}), ...callExtras(options) });
    }

    async post<T>(path: string, body: unknown, options: CallOptions): Promise<T> {
        return await this.request<T>({ method: 'POST', path, body, operationId: options.operationId, ...callExtras(options) });
    }

    async patch<T>(path: string, body: unknown, options: CallOptions): Promise<T> {
        return await this.request<T>({ method: 'PATCH', path, body, operationId: options.operationId, ...callExtras(options) });
    }

    async put<T>(path: string, body: unknown, options: CallOptions): Promise<T> {
        return await this.request<T>({ method: 'PUT', path, body, operationId: options.operationId, ...callExtras(options) });
    }

    async del<T>(path: string, options: CallOptions): Promise<T> {
        return await this.request<T>({ method: 'DELETE', path, operationId: options.operationId, ...callExtras(options) });
    }

    /**
     * Open a typed Server-Sent-Events stream against `path` (a runtime-plane
     * SSE endpoint). Reuses this client's own `fetch`, baseUrl, and the SHARED auth
     * authority (`resolveAuthHeaders`) — no separate token logic. The
     * reconnect loop + frame parsing live in `sse-client.ts`; this method only
     * provides the `connect` closure (fetch + status classification). Returns a
     * teardown handle synchronously.
     */
    openEventStream(
        path: string,
        handlers: EventStreamHandlers,
        options: EventStreamOptions = {},
    ): EventStreamHandle {
        const url = buildUrl(this.baseUrl, path);
        const connect = async (
            lastEventId: string | undefined,
            signal: AbortSignal,
        ): Promise<ConnectOutcome> => {
            // Same auth authority as the REST path; a missing direct token throws
            // ZarelAuthError here, which the loop surfaces as a terminal onError.
            const authHeaders = await resolveAuthHeaders(this.token, this.transportManaged, this.requireTokenCode);
            const headers: Record<string, string> = {
                ...authHeaders,
                'Accept': 'text/event-stream',
            };
            if (lastEventId !== undefined) {
                headers['Last-Event-ID'] = lastEventId;
            }
            let response: Response;
            try {
                response = await this.fetchFn(url, {
                    method: 'GET',
                    headers,
                    signal,
                    // Transport-managed (proxy/cookie): send credentials so the
                    // session cookie reaches the credential-injecting transport.
                    ...(this.transportManaged ? { credentials: 'include' } : {}),
                });
            } catch (error) {
                // Abort = teardown (the loop already knows it's closed); otherwise a
                // network error is transient → reconnect.
                if (signal.aborted) return { kind: 'transient' };
                return { kind: 'transient', error };
            }
            if (response.ok) {
                if (!response.body) return { kind: 'transient' };
                return { kind: 'open', body: response.body };
            }
            if (response.status === 401) {
                const apiError = await parseErrorBody(response);
                return { kind: 'terminal', error: new ZarelAuthError(apiError.message, 'unauthorized') };
            }
            // 408/429/5xx are retryable (transient); 403 + other 4xx are terminal.
            if (RETRYABLE_STATUS_CODES.has(response.status)) {
                return { kind: 'transient' };
            }
            return { kind: 'terminal', error: await parseErrorBody(response) };
        };
        return runEventStream({ connect, handlers, options });
    }

    /**
     * POST one MCP JSON-RPC message to a stateless MCP transport path
     * (POST /runtime/mcp) and return the typed JSON-RPC response. Reuses the
     * SHARED auth authority (`resolveAuthHeaders`) and the pure SSE
     * de-framer (`extractMcpResponse`), accepting either an `application/json`
     * body or a single `text/event-stream` frame. Unlike `request()` this does
     * NOT run the `{success,data}` envelope unwrap (MCP is bare JSON-RPC) and
     * makes a SINGLE attempt — no retry, no Idempotency-Key — because a
     * `tools/call` may be a non-idempotent mutation that must never be silently
     * re-issued. A protocol-level JSON-RPC error is returned in the union (not
     * thrown); transport failures throw exactly as the REST path (401 →
     * ZarelAuthError, other non-ok → ZarelAPIError).
     */
    async postMcp(
        path: string,
        message: McpJsonRpcRequest,
        requestOptions?: { signal?: AbortSignal },
    ): Promise<McpJsonRpcResponse> {
        const authHeaders = await resolveAuthHeaders(this.token, this.transportManaged, this.requireTokenCode);
        const url = buildUrl(this.baseUrl, path);
        const headers: Record<string, string> = {
            'User-Agent': USER_AGENT,
            ...(this.apiVersion !== undefined ? { [API_VERSION_HEADER]: this.apiVersion } : {}),
            ...authHeaders,
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/event-stream',
        };
        const response = await this.fetchWithTimeout(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(message),
            // Transport-managed (proxy/cookie): send credentials so the session
            // cookie reaches the credential-injecting transport.
            ...(this.transportManaged ? { credentials: 'include' } : {}),
        }, requestOptions?.signal);

        if (!response.ok) {
            if (response.status === 401) {
                const apiError = await parseErrorBody(response);
                throw new ZarelAuthError(apiError.message, 'unauthorized');
            }
            throw await parseErrorBody(response);
        }
        const bodyText = await response.text();
        return extractMcpResponse(response.headers.get('content-type'), bodyText);
    }

    private async fetchWithTimeout(url: string, init: RequestInit, signal?: AbortSignal): Promise<Response> {
        if (signal?.aborted) {
            throw createAbortError();
        }

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeout);
        const onAbort = (): void => {
            controller.abort();
        };

        signal?.addEventListener('abort', onAbort, { once: true });
        try {
            return await this.fetchFn(url, { ...init, signal: controller.signal });
        } catch (error) {
            if (isAbortError(error)) {
                if (signal?.aborted) {
                    throw createAbortError();
                }
                throw new ZarelTimeoutError(this.timeout);
            }
            throw error;
        } finally {
            signal?.removeEventListener('abort', onAbort);
            clearTimeout(timer);
        }
    }
}
