// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
import type { EventSubscriptionCreateBodyPayload } from '../generated';

// ── Roles ────────────────────────────────────────────────────────────────

export interface RoleAssignRequest {
    target_user_name: string;
    role_name: string;
    expires_at?: string;
}

// ── Events ───────────────────────────────────────────────────────────────

/**
 * DERIVED from the runtime API's OpenAPI document.
 *
 * `secret` is the HMAC key that signs deliveries; a non-string `secret` is refused, not
 * dropped.
 */
export type EventSubscriptionInput = EventSubscriptionCreateBodyPayload;

// `EventSubscriptionPatch` is deliberately NOT declared here. The operation has no accessor on
// this client, so a type for it would be exported from no barrel and imported by nobody — a
// speculative export. The payload alias exists in `generated/index.ts` for whoever adds the
// accessor.

export interface EventRecord {
    id: string;
    type: string;
    source: string;
    timestamp: string;
    payload?: Record<string, unknown>;
}

export interface EventListResponse {
    events: EventRecord[];
}

export interface EventSubscription {
    id: number;
    tenant_name?: string;
    event_name: string;
    webhook_url: string;
    is_active: boolean;
    /** Whether an HMAC signing key is configured. The KEY itself never leaves the server. */
    has_secret?: boolean;
    /** The configured header NAMES. Values never leave the server. */
    header_names?: string[];
    created_at: string;
    updated_at?: string;
}

export type EventSubscriptionResponse = EventSubscription;

export type EventSubscriptionListResponse = EventSubscription[];

export interface EventSubscriptionDeactivateResponse {
    id: number;
}

// ── Flows ────────────────────────────────────────────────────────────────
//
// `FlowCallbackResponse` lives in `./flows`, as an alias of the generated
// `FlowCallback` schema.

// ── Error Envelope ───────────────────────────────────────────────────────

export interface ErrorBody {
    error: {
        type: string;
        code: string;
        message: string;
        request_id?: string;
        field?: string;
    };
}
