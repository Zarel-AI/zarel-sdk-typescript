// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
/**
 * Wire-level types for the actions dispatch surface.
 *
 * Lives under `types/` so consumers can reach them via the
 * `@zarel-ai/sdk/types` subpath.
 */

export interface ActionDispatchParams {
    /** Optional record id for record-scoped actions. null/undefined for entity-level. */
    record_id?: string | number | null;
    /**
     * Optional operator note. The server IGNORES it (it is not part of the
     * runtime API's request body); it remains because the `@zarel-ai/react`
     * confirm dialog still collects it.
     */
    notes?: string;
    /** Optional payload forwarded to the underlying entity intent. */
    payload?: Record<string, unknown>;
    /**
     * Optional idempotency key. V1 wire-format-only pass-through; server-side
     * deduplication is not yet implemented.
     */
    idempotency_key?: string;
}

export interface ActionDispatchSuccessResponse {
    success: true;
    /** The dispatched record (for create/update verbs). null for delete. */
    data: Record<string, unknown> | null;
    /** Telemetry tag: the name of the action that was dispatched. */
    resolved_via_action: string;
}
