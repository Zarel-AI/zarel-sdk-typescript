// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// contract.metadata (composite singleton).
//
// Maps to the contract API's `/contract/metadata`. The tenant's STRUCTURAL fields
// (`domain`, `spec_version`) plus its RESOLVED `label`, which this route does not store: the
// server resolves it from the contract's labels for the request locale.
//
// What the types hold:
//   - `label` is REFUSED by both `put` and `patch` — it is not stored by this route — so
//     it is unspellable on the write type.
//   - The read always carries `name`, `label` and `domain`, and `semantic_version` when set.

import type { FetchClient } from '../_internal/fetch-client';
import { localeQuery } from '../_internal/fetch-client';
import type { LocaleOptions } from '../types/locale';
import type {
    ContractTenantMetadata,
    ContractTenantMetadataWrite,
} from '../types/treatment-contract';

export type { ContractTenantMetadata, ContractTenantMetadataWrite };

export class MetadataResource {
    constructor(private readonly client: FetchClient) {}

    async get(options?: LocaleOptions): Promise<ContractTenantMetadata> {
        return await this.client.get<ContractTenantMetadata>('/contract/metadata', localeQuery(options), { operationId: 'getTenantMetadata' });
    }

    async put(input: ContractTenantMetadataWrite): Promise<ContractTenantMetadata> {
        return await this.client.put<ContractTenantMetadata>('/contract/metadata', input, { operationId: 'putTenantMetadata' });
    }

    async patch(patch: ContractTenantMetadataWrite): Promise<ContractTenantMetadata> {
        return await this.client.patch<ContractTenantMetadata>('/contract/metadata', patch, { operationId: 'patchTenantMetadata' });
    }
}
