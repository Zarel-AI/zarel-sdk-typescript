// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// contract.admin.constraints CRUD.
// Maps to the contract API's `/contract/constraints` routes.

import type { FetchClient } from '../_internal/fetch-client';
import type { ConstraintCreate, ConstraintRecord, ConstraintWrite } from '../types/collections-contract';
import type { ContractDeletedAck } from '../types/flows-contract';

export type { ConstraintCreate, ConstraintRecord, ConstraintWrite };

export class ConstraintsResource {
    constructor(private readonly client: FetchClient) {}

    async list(): Promise<ConstraintRecord[]> {
        return await this.client.get('/contract/constraints', undefined, { operationId: 'listConstraints' });
    }

    async get(name: string): Promise<ConstraintRecord> {
        return await this.client.get(`/contract/constraints/${encodeURIComponent(name)}`, undefined, { operationId: 'getConstraint' });
    }

    async create(input: ConstraintCreate): Promise<ConstraintRecord> {
        return await this.client.post('/contract/constraints', input, { operationId: 'createConstraint' });
    }

    async put(name: string, input: ConstraintWrite): Promise<ConstraintRecord> {
        return await this.client.put(`/contract/constraints/${encodeURIComponent(name)}`, input, { operationId: 'replaceConstraint' });
    }

    async patch(name: string, patch: ConstraintWrite): Promise<ConstraintRecord> {
        return await this.client.patch(`/contract/constraints/${encodeURIComponent(name)}`, patch, { operationId: 'patchConstraint' });
    }

    async delete(name: string): Promise<ContractDeletedAck> {
        return await this.client.del<ContractDeletedAck>(`/contract/constraints/${encodeURIComponent(name)}`, { operationId: 'deleteConstraint' });
    }
}
