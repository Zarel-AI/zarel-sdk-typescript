// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// contract.admin.capabilities CRUD.
// Maps to the contract API's `/contract/capabilities` routes.

import type { FetchClient } from '../_internal/fetch-client';
import type { CapabilityCreate, CapabilityRecord, CapabilityWrite } from '../types/collections-contract';
import type { ContractDeletedAck } from '../types/flows-contract';

export type { CapabilityCreate, CapabilityRecord, CapabilityWrite };

export class CapabilitiesResource {
    constructor(private readonly client: FetchClient) {}

    async list(): Promise<CapabilityRecord[]> {
        return await this.client.get('/contract/capabilities', undefined, { operationId: 'listCapabilities' });
    }

    async get(name: string): Promise<CapabilityRecord> {
        return await this.client.get(`/contract/capabilities/${encodeURIComponent(name)}`, undefined, { operationId: 'getCapability' });
    }

    async create(input: CapabilityCreate): Promise<CapabilityRecord> {
        return await this.client.post('/contract/capabilities', input, { operationId: 'createCapability' });
    }

    async put(name: string, input: CapabilityWrite): Promise<CapabilityRecord> {
        return await this.client.put(`/contract/capabilities/${encodeURIComponent(name)}`, input, { operationId: 'replaceCapability' });
    }

    async patch(name: string, patch: CapabilityWrite): Promise<CapabilityRecord> {
        return await this.client.patch(`/contract/capabilities/${encodeURIComponent(name)}`, patch, { operationId: 'patchCapability' });
    }

    async delete(name: string): Promise<ContractDeletedAck> {
        return await this.client.del<ContractDeletedAck>(`/contract/capabilities/${encodeURIComponent(name)}`, { operationId: 'deleteCapability' });
    }
}
