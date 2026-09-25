// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// Shared path-recording fetch harness for SDK tests.
//
// A jest-mocked `fetch` that records every (method, url) the SDK emits, plus
// a `Zarel` wired to it on both planes with distinguishable base hosts so a
// test can assert which plane a call targeted. Used by the plane-routing
// regression (plane-routing.regression.test.ts) and the token-provider tests.

import { Zarel } from '../../src/client';
import type { ZarelOptions } from '../../src/client';

export type MockFetch = jest.Mock<
    Promise<Response>,
    [input: string | URL | Request, init?: RequestInit]
>;

export const RUNTIME_BASE = 'https://acme.example.com/v1';
export const CONTRACT_BASE = 'https://acme.admin.example.com/v1';

export function makeMockFetch(): MockFetch {
    return jest
        .fn<Promise<Response>, [input: string | URL | Request, init?: RequestInit]>()
        .mockResolvedValue({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ success: true, data: {} }),
            headers: new Headers({ 'content-type': 'application/json' }),
        } as Response);
}

/**
 * Build a Zarel whose runtime/contract planes resolve to DISTINCT hosts, so a
 * test can read the recorded URL's origin and pathname to verify both the
 * plane (host) and the canonical path prefix.
 */
export function makeRecordingClient(overrides?: Partial<ZarelOptions>): {
    zarel: Zarel;
    fetchFn: MockFetch;
} {
    const fetchFn = makeMockFetch();
    const zarel = new Zarel({
        runtimeToken: 'rt-token',
        contractToken: 'ct-token',
        runtimeBaseUrl: RUNTIME_BASE,
        contractBaseUrl: CONTRACT_BASE,
        maxRetries: 0,
        fetch: fetchFn,
        ...overrides,
    });
    return { zarel, fetchFn };
}

export function callUrl(fetchFn: MockFetch, index = 0): URL {
    const call = fetchFn.mock.calls[index];
    if (!call) throw new Error(`Expected a fetch call at index ${index}`);
    return new URL(call[0] as string);
}

export function callInit(fetchFn: MockFetch, index = 0): RequestInit {
    const call = fetchFn.mock.calls[index];
    if (!call) throw new Error(`Expected a fetch call at index ${index}`);
    return (call[1] ?? {}) as RequestInit;
}
