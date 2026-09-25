// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// contract.admin.processModel.phases CRUD.
//
// Maps to the contract API's `/contract/process-model/phases` routes. The
// `/contract/process-model` document itself is `ProcessModelResource` below.

import type { FetchClient } from '../_internal/fetch-client';
import type { PhaseCreate, PhaseRecord, PhaseWrite } from '../types/collections-contract';
import type { ContractDeletedAck } from '../types/flows-contract';
import type { ContractProcessModelPatchPayload, ContractProcessModelWritePayload } from '../generated';
import { SingletonAccessor, type JsonObject } from './_singleton';

// The READ is still `JsonObject`: `getProcessModel` publishes a bare `OkEnvelope`, so there is
// nothing to point the first parameter at. The WRITE is `ContractProcessModelWrite` — the model
// minus `phases`, which has its own collection — and the PATCH is its own body, which requires
// nothing because the merge base supplies it.

export type { PhaseCreate, PhaseRecord, PhaseWrite };

export class ProcessModelPhasesResource {
    constructor(private readonly client: FetchClient) {}

    async list(): Promise<PhaseRecord[]> {
        return await this.client.get('/contract/process-model/phases', undefined, { operationId: 'listProcessModelPhases' });
    }

    async get(name: string): Promise<PhaseRecord> {
        return await this.client.get(`/contract/process-model/phases/${encodeURIComponent(name)}`, undefined, { operationId: 'getProcessModelPhase' });
    }

    async create(input: PhaseCreate): Promise<PhaseRecord> {
        return await this.client.post('/contract/process-model/phases', input, { operationId: 'createProcessModelPhase' });
    }

    async put(name: string, input: PhaseWrite): Promise<PhaseRecord> {
        return await this.client.put(`/contract/process-model/phases/${encodeURIComponent(name)}`, input, { operationId: 'replaceProcessModelPhase' });
    }

    async patch(name: string, patch: PhaseWrite): Promise<PhaseRecord> {
        return await this.client.patch(`/contract/process-model/phases/${encodeURIComponent(name)}`, patch, { operationId: 'patchProcessModelPhase' });
    }

    async delete(name: string): Promise<ContractDeletedAck> {
        return await this.client.del<ContractDeletedAck>(`/contract/process-model/phases/${encodeURIComponent(name)}`, { operationId: 'deleteProcessModelPhase' });
    }
}

/**
 * `contract.processModel` — the process-model document (`get`/`put`/`patch` on
 * `/contract/process-model`) PLUS its `phases` collection
 * (`/contract/process-model/phases`), mirroring the HTTP parent/child hierarchy.
 */
export class ProcessModelResource extends SingletonAccessor<
    JsonObject, ContractProcessModelWritePayload, ContractProcessModelPatchPayload
> {
    readonly phases: ProcessModelPhasesResource;
    constructor(client: FetchClient) {
        super(client, '/contract/process-model', {
            get: 'getProcessModel',
            put: 'putProcessModel',
            patch: 'patchProcessModel',
        });
        this.phases = new ProcessModelPhasesResource(client);
    }
}
