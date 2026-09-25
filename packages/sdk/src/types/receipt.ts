// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
/**
 * Receipt read-surface types (end-user verifiable receipts).
 *
 * Wire shapes of the runtime API's receipt responses, kept as plain interfaces
 * with no dependencies (same convention as `types/audit.ts`).
 *
 * A `Receipt` is the caller's OWN governance event, normalized over the three
 * audit signals. It carries only a non-reversible proof (hash + masked value +
 * contract version, per signal) — never the raw value, never `tenant_name`.
 */

export type ReceiptSignal = 'refusal' | 'binding_violation' | 'validation_violation';

export interface ReceiptProof {
    readonly input_sha256?: string;
    readonly input_masked?: string;
    readonly contract_version?: number;
}

export interface RefusalReceipt {
    readonly id: string;
    readonly signal: 'refusal';
    readonly created_at: string;
    readonly trace_id: string;
    readonly proof: ReceiptProof;
    readonly detail: {
        readonly kind: 'refusal';
        readonly category: string;
        readonly reason: 'matched' | 'no_verdict' | 'unscored';
        readonly verdict: string;
        readonly confidence: number | null;
        readonly channel_name: string | null;
        readonly fallback_used: boolean;
    };
}

export interface BindingReceipt {
    readonly id: string;
    readonly signal: 'binding_violation';
    readonly created_at: string;
    readonly trace_id: string;
    readonly proof: ReceiptProof;
    readonly detail: {
        readonly kind: 'binding';
        readonly entity: string;
        readonly field: string;
        readonly binding_mode: 'bind' | 'assert' | 'immutable';
        readonly reason: string;
        readonly path_context: string | null;
    };
}

export interface ValidationReceipt {
    readonly id: string;
    readonly signal: 'validation_violation';
    readonly created_at: string;
    readonly trace_id: string;
    readonly proof: ReceiptProof;
    readonly detail: {
        readonly kind: 'validation';
        readonly entity: string;
        readonly rule_name: string;
        readonly op: 'create' | 'update' | 'delete';
        readonly message_key: string;
        readonly details: Record<string, unknown>;
    };
}

export type Receipt = RefusalReceipt | BindingReceipt | ValidationReceipt;

/** Query filters for `client.runtime.receipts.list`. `from`/`to` are inclusive ISO date-time bounds. */
export interface ReceiptListParams {
    readonly signal?: ReceiptSignal;
    readonly trace_id?: string;
    readonly from?: string;
    readonly to?: string;
    readonly limit?: number;
    readonly cursor?: string;
}

export interface ReceiptListResponse {
    readonly items: ReadonlyArray<Receipt>;
    readonly next_cursor: string | null;
}
