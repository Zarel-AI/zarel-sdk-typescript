// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// contract.admin.schemas CRUD.
// Maps to the contract API's `/contract/schemas` routes.

import type { FetchClient } from '../_internal/fetch-client';
import type { SchemaCreate, SchemaRecord, SchemaWrite } from '../types/collections-contract';
import type { ContractDeletedAck } from '../types/flows-contract';

export type { SchemaCreate, SchemaRecord, SchemaWrite };

export class SchemasResource {
    constructor(private readonly client: FetchClient) {}

    async list(): Promise<SchemaRecord[]> {
        return await this.client.get('/contract/schemas', undefined, { operationId: 'listSchemas' });
    }

    async get(name: string): Promise<SchemaRecord> {
        return await this.client.get(`/contract/schemas/${encodeURIComponent(name)}`, undefined, { operationId: 'getSchema' });
    }

    async create(input: SchemaCreate): Promise<SchemaRecord> {
        return await this.client.post('/contract/schemas', input, { operationId: 'createSchema' });
    }

    async put(name: string, input: SchemaWrite): Promise<SchemaRecord> {
        return await this.client.put(`/contract/schemas/${encodeURIComponent(name)}`, input, { operationId: 'replaceSchema' });
    }

    async patch(name: string, patch: SchemaWrite): Promise<SchemaRecord> {
        return await this.client.patch(`/contract/schemas/${encodeURIComponent(name)}`, patch, { operationId: 'patchSchema' });
    }

    async delete(name: string): Promise<ContractDeletedAck> {
        return await this.client.del<ContractDeletedAck>(`/contract/schemas/${encodeURIComponent(name)}`, { operationId: 'deleteSchema' });
    }
}
