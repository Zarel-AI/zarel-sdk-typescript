// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// Client-level request/response/error interceptors. Pure types + tiny
// runners; zero runtime deps. Hooks fire PER NETWORK ATTEMPT (so retries are
// observable). `onResponse`/`onError` are mutually exclusive per attempt: a
// response (any status) fires `onResponse`; a transport failure that produced no
// response (network error / timeout) fires `onError`.
import type { HttpMethod } from './fetch-client';

/** Passed to `onRequest`. `headers` is MUTABLE — mutate it in place to add or
 *  override outgoing headers (the only mutable interceptor surface). */
export interface RequestInterceptorContext {
    method: HttpMethod;
    url: string;
    headers: Record<string, string>;
    attempt: number; // 0-based; increments across retries
}

/** Passed to `onResponse` for every HTTP response received (any status). Read-only. */
export interface ResponseInterceptorContext {
    method: HttpMethod;
    url: string;
    status: number;
    attempt: number;
}

/** Passed to `onError` only for a transport failure with no HTTP response
 *  (network error / timeout). Read-only — no `status` by construction. */
export interface ErrorInterceptorContext {
    method: HttpMethod;
    url: string;
    error: unknown;
    attempt: number;
}

export interface Interceptors {
    /** Runs after the transport assembles the per-attempt headers (auth,
     *  idempotency, identity). May mutate `ctx.headers`. A throw ABORTS the
     *  request (no network call, no retry) — a legitimate pre-flight veto. */
    onRequest?: (ctx: RequestInterceptorContext) => void | Promise<void>;
    /** Observes every HTTP response (any status). A throw is swallowed. */
    onResponse?: (ctx: ResponseInterceptorContext) => void | Promise<void>;
    /** Observes a no-response transport failure. A throw is swallowed. */
    onError?: (ctx: ErrorInterceptorContext) => void | Promise<void>;
}

/** Invoke `onResponse`, swallowing any throw so an observation hook can never
 *  mask the real response or alter control flow. */
export async function runOnResponse(
    interceptors: Interceptors | undefined,
    ctx: ResponseInterceptorContext,
): Promise<void> {
    if (!interceptors?.onResponse) return;
    try {
        await interceptors.onResponse(ctx);
    } catch {
        // swallow — observation hooks must not corrupt the request outcome
    }
}

/** Invoke `onError`, swallowing any throw (same rationale as `runOnResponse`). */
export async function runOnError(
    interceptors: Interceptors | undefined,
    ctx: ErrorInterceptorContext,
): Promise<void> {
    if (!interceptors?.onError) return;
    try {
        await interceptors.onError(ctx);
    } catch {
        // swallow
    }
}
