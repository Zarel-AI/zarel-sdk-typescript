// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
import type { ConfirmationChallenge } from './types/confirmation';

/**
 * Base error class for all Zarel SDK errors.
 */
export class ZarelError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ZarelError';
    }
}

/**
 * Thrown when the API returns a non-2xx response.
 * Contains the structured error envelope from the server.
 */
export class ZarelAPIError extends ZarelError {
    readonly status: number;
    readonly type: string;
    readonly code: string;
    readonly requestId: string | undefined;
    readonly field: string | undefined;
    /**
     * Non-standard top-level fields of the error body (everything except the
     * canonical `error` envelope). Lets endpoints attach structured recovery
     * data alongside the error — e.g. the contract-assistant apply 409
     * `contract_hash_mismatch` carries `reseeded_changeset_id` + `base_hash`
     * so a client recovers the re-seeded handle without parsing prose.
     */
    readonly details: Readonly<Record<string, unknown>> | undefined;
    /**
     * The confirmation challenge from a `409 confirmation_required` — every
     * `confirm` guard that paused this write plus the ONE consent token bound to
     * the whole set.
     *
     * Its own field rather than part of `details` because it rides INSIDE the
     * `error` envelope, which `details` deliberately excludes. Present only when
     * the server sent a complete challenge; a caller that renders every
     * `guards[]` prompt and re-sends the IDENTICAL request with
     * `confirmationToken: challenge.token` proceeds.
     */
    readonly confirmation: ConfirmationChallenge | undefined;

    constructor(
        status: number,
        type: string,
        code: string,
        message: string,
        requestId?: string,
        field?: string,
        details?: Readonly<Record<string, unknown>>,
        confirmation?: ConfirmationChallenge,
    ) {
        super(message);
        this.name = 'ZarelAPIError';
        this.status = status;
        this.type = type;
        this.code = code;
        this.requestId = requestId;
        this.field = field;
        this.details = details;
        this.confirmation = confirmation;
    }
}

/**
 * Discriminator for `ZarelAuthError.code`:
 *   - `'unauthorized'` — server returned 401.
 *   - `'runtime_token_missing'` — `client.runtime.*` invoked without `runtimeToken`.
 *   - `'contract_token_missing'` — `client.contract.*` invoked without `contractToken`.
 *
 * The two `_missing` codes are raised by the SDK before any network I/O;
 * `'unauthorized'` is raised by `FetchClient` on a server 401. Consumers
 * MUST branch on `code` rather than message text.
 */
export type ZarelAuthErrorCode =
    | 'unauthorized'
    | 'runtime_token_missing'
    | 'contract_token_missing';

/**
 * Thrown when authentication fails (missing token, expired, invalid)
 * or when a namespace method is invoked without its plane token configured.
 */
export class ZarelAuthError extends ZarelError {
    readonly code: ZarelAuthErrorCode;

    constructor(message: string, code: ZarelAuthErrorCode) {
        super(message);
        this.name = 'ZarelAuthError';
        this.code = code;
    }
}

/**
 * Thrown when a request times out.
 */
export class ZarelTimeoutError extends ZarelError {
    constructor(timeoutMs: number) {
        super(`Request timed out after ${timeoutMs}ms`);
        this.name = 'ZarelTimeoutError';
    }
}
