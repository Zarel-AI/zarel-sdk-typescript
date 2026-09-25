// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
import { requireToken } from './require-token';
import type { TokenInput } from './fetch-client';

export type RequireTokenCode = 'runtime_token_missing' | 'contract_token_missing';

/**
 * The SINGLE auth authority shared by BOTH request paths — the REST
 * `FetchClient` and the SSE stream client. Given a token (string or provider)
 * and the transport-managed flag, it resolves the token (honoring the optional
 * presence guard) and returns the `Authorization` header decision:
 *
 *   - transport-managed → `{}` (the credential-injecting transport sets the
 *     header server-side; the SDK omits it and skips the presence guard);
 *   - direct, empty token → `{}` (no bearer);
 *   - direct, present token → `{ Authorization: 'Bearer <token>' }`.
 *
 * Centralizing this here means there is exactly one place that builds a Bearer
 * header — neither the SSE client nor any resource may build its own (a
 * structural test enforces a single `Bearer ` site).
 */
export async function resolveAuthHeaders(
    token: TokenInput,
    transportManaged: boolean,
    requireTokenCode?: RequireTokenCode,
): Promise<Record<string, string>> {
    if (transportManaged) {
        return {};
    }
    const resolved = typeof token === 'function' ? await token() : token;
    if (requireTokenCode) {
        requireToken(resolved, requireTokenCode);
    }
    return resolved === '' ? {} : { 'Authorization': `Bearer ${resolved}` };
}
