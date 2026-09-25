// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
import type { FetchClient } from '../_internal/fetch-client';
import type {
    SnapshotImportRequest,
    SnapshotImportResponse,
} from '../types/imports';

export class ImportsResource {
    constructor(private readonly client: FetchClient) {}

    async snapshot(request: SnapshotImportRequest): Promise<SnapshotImportResponse> {
        return await this.client.post<SnapshotImportResponse>('/runtime/imports/snapshot', request, { operationId: 'runtimeImportsSnapshot' });
    }
}
