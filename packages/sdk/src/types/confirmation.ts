// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
/**
 * The client half of the confirmation round-trip.
 *
 * A `confirm` guard pauses a write and answers `409 confirmation_required`
 * carrying, under `error.confirmation`, every guard that fired plus ONE consent
 * token bound to the whole set. The caller shows the human every prompt and
 * re-submits the IDENTICAL request with the token in `X-Zarel-Confirmation-Token`.
 *
 * Hand-authored rather than imported from `@zarel-ai/contract/core` — the SDK
 * ships no runtime dependency on the platform packages, and its wire types are
 * the OpenAPI projection. A compile-time test pins these against
 * `generated/runtime.ts`, so a spec change that renames or adds a field fails
 * the suite instead of drifting silently.
 */

/** One guard that paused a write, with the prompt the human is shown for it. */
export interface ConfirmationGuard {
    /**
     * The guard's own name: an entity check's `name`, or `<field>__<from>__<to>`
     * for a state-machine edge. Never a governed action name.
     */
    readonly name: string;
    /** Human-readable prompt for THIS guard, resolved server-side. */
    readonly prompt: string;
}

/**
 * The challenge attached to a `409 confirmation_required`.
 *
 * ONE challenge per WRITE, not per guard: a single write can fire several
 * `confirm` guards at once and the token is bound to the whole set. A caller
 * MUST render every entry of {@link guards} before retrying — consenting on one
 * prompt while another stayed hidden signs for a condition the operator never
 * saw.
 */
export interface ConfirmationChallenge {
    /** Every guard that fired on this write. Never empty. */
    readonly guards: readonly ConfirmationGuard[];
    /** The opaque `zct1.…` consent token to echo on the confirming retry. */
    readonly token: string;
    /** ISO-8601 expiry — the caller cannot derive it from the opaque token. */
    readonly expires_at: string;
}

/**
 * Per-call option accepted by every write that a `confirm` guard can pause.
 *
 * The retry must re-send the request BYTE-IDENTICAL: the token binds the payload
 * as it was requested, so an edited retry is a different write and is challenged
 * again by design.
 */
export interface ConfirmationRetryOptions {
    /** `challenge.token` from the prior `409 confirmation_required`. */
    confirmationToken?: string;
}
