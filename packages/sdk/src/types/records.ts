// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// ── Records ──────────────────────────────────────────────────────────────

/**
 * A resolved reference label as delivered in the `ref_labels` sidecar.
 * A `string` for a single `reference`; a positional array (aligned to the id
 * array, `null` where the target record was not visible) for a `reference[]`. This
 * single-shape union is the wire contract — consumers should read it through the
 * `@zarel-ai/react` `singleRefLabel` / `refLabelAt` accessors rather than
 * hand-narrowing `typeof` / `Array.isArray`.
 */
export type RefLabel = string | Array<string | null>;

export interface RecordData {
    id?: number;
    owner_name?: string;
    created_at?: string;
    updated_at?: string;
    /**
     * Resolved reference labels, keyed by reference field name. Absent
     * when the field has no resolvable label — consumers fall back to `<entity>#<id>`.
     */
    ref_labels?: Record<string, RefLabel>;
    [key: string]: unknown;
}

export type FilterOp =
    | 'eq' | 'neq'
    | 'contains' | 'startsWith' | 'endsWith'
    | 'gt' | 'gte' | 'lt' | 'lte'
    | 'between'
    | 'in' | 'not_in'
    | 'before' | 'after'
    | 'is_empty' | 'is_not_empty';

export interface FilterExpr {
    op: FilterOp;
    value?: unknown;
}

export type FilterValue = string | number | boolean | FilterExpr | FilterExpr[];

export type SortDir = 'asc' | 'desc';

export interface SortSpec {
    field: string;
    dir: SortDir;
}

export interface RecordListParams {
    limit?: number;
    offset?: number;
    filters?: Record<string, FilterValue>;
    sort?: SortSpec[];
}

// The transport unwraps the {success,data} envelope, so these
// response types are the UNWRAPPED `data` payloads (no envelope wrapper).
export interface RecordListResponse {
    records: RecordData[];
    total: number;
}

export type RecordResponse = RecordData;

export type { BulkImportRequest, BulkImportResponse } from './imports';
