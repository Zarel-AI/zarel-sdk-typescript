// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
import { ZarelAuthError } from '../errors';
import type { ZarelAuthErrorCode } from '../errors';

/**
 * Guard that a plane's token is configured
 * before any network I/O is attempted.
 *
 * Called at the entry of every resource method in `client.runtime.*` and
 * `client.contract.*`. The check is pure and deterministic — no side
 * effects beyond the throw. The thrown `ZarelAuthError.code` is one of
 * `'runtime_token_missing'` or `'contract_token_missing'`; server-issued
 * 401s use `'unauthorized'` and are raised by FetchClient instead.
 *
 * JWT-class and API-key-prefix validation is the server's
 * responsibility; this helper does NOT inspect token contents — only
 * presence.
 */
export function requireToken(
    token: string | undefined,
    code: Extract<ZarelAuthErrorCode, 'runtime_token_missing' | 'contract_token_missing'>,
): void {
    if (token && token.length > 0) return;
    const plane = code === 'runtime_token_missing' ? 'runtime' : 'contract';
    throw new ZarelAuthError(
        `${plane} token not configured — pass ${plane}Token to Zarel constructor`,
        code,
    );
}
