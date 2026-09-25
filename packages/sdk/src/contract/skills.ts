// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// contract.skills CRUD.
//
// Maps to the contract API's `/contract/skills` routes, including `put` and `patch`.

import { type FetchClient, localeQuery } from '../_internal/fetch-client';
import type { SkillPatchPayload, SkillWritePayload } from '../generated';
import type { ContractDeletedAck } from '../types/flows-contract';
import type { LocaleOptions } from '../types/locale';

/**
 * `POST /contract/skills` and `PUT /contract/skills/{name}` — one shape, DERIVED from the published
 * body. A `put` REPLACES: a list it omits is stored empty and an omitted `mcp_tool` is removed.
 */
export type SkillWriteInput = SkillWritePayload;
/** `PATCH /contract/skills/{name}` — every key optional, `name` restatable and not changeable. */
export type SkillPatchInput = SkillPatchPayload;

export interface SkillsResourceListItem {
    readonly name: string;
    readonly version?: string;
    readonly intent_triggers?: readonly string[];
    readonly required_entities?: readonly string[];
    readonly [key: string]: unknown;
}

export class SkillsResource {
    constructor(private readonly client: FetchClient) {}

    async list(options?: LocaleOptions): Promise<SkillsResourceListItem[]> {
        return await this.client.get('/contract/skills', localeQuery(options), { operationId: 'listSkills' });
    }

    async get(name: string, options?: LocaleOptions): Promise<SkillsResourceListItem> {
        return await this.client.get(`/contract/skills/${encodeURIComponent(name)}`, localeQuery(options), { operationId: 'getSkill' });
    }

    async create(input: SkillWriteInput): Promise<SkillsResourceListItem> {
        return await this.client.post('/contract/skills', input, { operationId: 'createSkill' });
    }

    async put(name: string, input: SkillWriteInput): Promise<SkillsResourceListItem> {
        return await this.client.put(`/contract/skills/${encodeURIComponent(name)}`, input, { operationId: 'replaceSkill' });
    }

    async patch(name: string, patch: SkillPatchInput): Promise<SkillsResourceListItem> {
        return await this.client.patch(`/contract/skills/${encodeURIComponent(name)}`, patch, { operationId: 'patchSkill' });
    }

    /** `ContractDeletedAck`, not `void`: this route answers `{success, data: {message}}`. */
    async delete(name: string): Promise<ContractDeletedAck> {
        return await this.client.del<ContractDeletedAck>(`/contract/skills/${encodeURIComponent(name)}`, { operationId: 'deleteSkill' });
    }
}
