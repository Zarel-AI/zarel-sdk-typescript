// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// contract.treatment.profiles — the named treatment overrides.
// CRUD on /contract/treatment/profiles (+ /{name}).
//
// Every shape is derived from the published schema; see `types/treatment-contract.ts`.

import type { FetchClient } from '../../_internal/fetch-client';
import type {
    ContractDeletedAck,
    ContractProfile,
    ContractProfileCreate,
    ContractProfileWrite,
} from '../../types/treatment-contract';

export type { ContractProfile };

export class ProfilesResource {
    constructor(private readonly client: FetchClient) {}

    private base(): string {
        return '/contract/treatment/profiles';
    }

    async list(): Promise<ContractProfile[]> {
        return await this.client.get<ContractProfile[]>(this.base(), undefined, { operationId: 'listProfiles' });
    }

    async get(name: string): Promise<ContractProfile> {
        return await this.client.get<ContractProfile>(`${this.base()}/${encodeURIComponent(name)}`, undefined, { operationId: 'getProfile' });
    }

    /** Creates, or RESURRECTS a profile that was previously deleted. A live name is a 409. */
    async create(input: ContractProfileCreate): Promise<ContractProfile> {
        return await this.client.post<ContractProfile>(this.base(), input, { operationId: 'createProfile' });
    }

    /** The body is the FLAT treatment — no `name`, since the path already has it. */
    async put(name: string, input: ContractProfileWrite): Promise<ContractProfile> {
        return await this.client.put<ContractProfile>(`${this.base()}/${encodeURIComponent(name)}`, input, { operationId: 'replaceProfile' });
    }

    /** REPLACES the whole blob, exactly like `put` — the route does not merge. */
    async patch(name: string, patch: ContractProfileWrite): Promise<ContractProfile> {
        return await this.client.patch<ContractProfile>(`${this.base()}/${encodeURIComponent(name)}`, patch, { operationId: 'patchProfile' });
    }

    /** Answers `{message}`, not an empty body — and the name can be created again after. */
    async delete(name: string): Promise<ContractDeletedAck> {
        return await this.client.del<ContractDeletedAck>(`${this.base()}/${encodeURIComponent(name)}`, { operationId: 'deleteProfile' });
    }
}
