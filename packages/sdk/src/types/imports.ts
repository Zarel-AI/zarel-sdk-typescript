// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
export type ImportExecutionMode = 'strict' | 'best_effort';

export interface BulkImportItem {
    data: Record<string, unknown>;
    owner_name?: string;
}

export interface BulkImportRequest {
    items: BulkImportItem[];
    mode?: ImportExecutionMode;
}

export interface BulkImportItemResult {
    index: number;
    status: 'created' | 'failed' | 'skipped';
    record?: unknown;
    error?: string;
}

export interface BulkImportResponse {
    success: boolean;
    entity_name: string;
    mode: ImportExecutionMode;
    total_items: number;
    processed_items: number;
    imported_count: number;
    failed_count: number;
    skipped_count: number;
    items: BulkImportItemResult[];
}

export interface SnapshotImportFile {
    metadata: {
        format_version: string;
        tenant: string;
        exported_at?: string;
        description?: string;
    };
    users: Array<{
        user_name: string;
        roles: [string, ...string[]];
    }>;
    records: Record<string, Array<{
        owner_name: string;
        id?: number;
        created_at?: string;
        data: Record<string, unknown>;
    }>>;
}

/**
 * NARROWER THAN THE WIRE ON `data`, for the reason `WorkflowReplayRequest` states: the published
 * `SnapshotImportBody.data` is an open bag — a tenant's own records, judged against that tenant's
 * contract — and `SnapshotImportFile` is the useful shape a caller wants help with. Not derived.
 *
 * The two MODES are the wire's exactly, and both are optional here and there: the published body
 * carries no `default:` keywords, because openapi-typescript emits a property carrying one as
 * REQUIRED, which had made the generated type disagree with this one.
 */
export interface SnapshotImportRequest {
    data: SnapshotImportFile;
    mode?: 'clean' | 'restore';
    validation_mode?: 'fail-fast' | 'collect-errors';
}

export interface SnapshotImportResponse {
    success: boolean;
    tenant_name: string;
    users_imported: number;
    records_imported: number;
    errors: string[];
}
