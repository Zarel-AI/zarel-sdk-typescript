// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
/**
 * Confirmation round-trip transport helpers — the single place
 * the SDK names the header and the single place it parses the challenge.
 */

import type { ConfirmationChallenge, ConfirmationGuard } from '../types/confirmation';

/** The retry header. Read server-side from the header only, never the body. */
export const CONFIRMATION_TOKEN_HEADER = 'X-Zarel-Confirmation-Token';

/** `{}` when no token — so a caller can spread this unconditionally. */
export function confirmationHeaders(token?: string): Record<string, string> {
    return token ? { [CONFIRMATION_TOKEN_HEADER]: token } : {};
}

/**
 * Parse `error.confirmation` off a 409 body, fail-closed.
 *
 * Returns undefined unless the challenge is COMPLETE — at least one named guard
 * AND a token. A challenge with no token cannot be round-tripped, and one with
 * no guard has no prompt to show, so surfacing either as a confirmable error
 * would offer the operator a Confirm button that can only fail. Undefined
 * degrades the 409 to an ordinary API error, which is the honest outcome.
 *
 * A guard missing its `prompt` is kept with a name-derived fallback (the name is
 * what makes it auditable); a guard missing its `name` is dropped, mirroring
 * `parseConfirmationGuards` in `@zarel-ai/contract/core`.
 */
export function parseConfirmationChallenge(raw: unknown): ConfirmationChallenge | undefined {
    if (typeof raw !== 'object' || raw === null) return undefined;
    const { guards, token, expires_at: expiresAt } = raw as Record<string, unknown>;
    if (typeof token !== 'string' || token.length === 0) return undefined;
    if (!Array.isArray(guards)) return undefined;

    const parsed: ConfirmationGuard[] = [];
    for (const entry of guards) {
        if (typeof entry !== 'object' || entry === null) continue;
        const { name, prompt } = entry as Record<string, unknown>;
        if (typeof name !== 'string' || name.length === 0) continue;
        parsed.push({ name, prompt: typeof prompt === 'string' ? prompt : `Confirm "${name}"` });
    }
    if (parsed.length === 0) return undefined;

    return {
        guards: parsed,
        token,
        expires_at: typeof expiresAt === 'string' ? expiresAt : '',
    };
}
