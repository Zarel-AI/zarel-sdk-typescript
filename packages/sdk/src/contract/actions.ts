// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// contract.actions CRUD.
//
// Maps to the contract API's `/contract/actions` routes. Runtime invocation of an action
// is `runtime.actions.dispatch()` on the runtime namespace — distinct from this
// surface, which manages the action definitions.

import type { FetchClient } from '../_internal/fetch-client';
import type { ActionPatchPayload, ActionWritePayload } from '../generated';
import type { ContractDeletedAck } from '../types/flows-contract';

/**
 * `POST /contract/actions` and `PUT /contract/actions/{name}` — one shape, DERIVED from the
 * published request body.
 *
 * `expose_as_mcp_tool` IS carried here: both writes accept it and the server stores it.
 */
export type ContractActionWriteInput = ActionWritePayload;
/** `PATCH /contract/actions/{name}` — every key optional, `name` restatable and not changeable. */
export type ContractActionPatchInput = ActionPatchPayload;

export interface ContractActionDefinition {
    readonly name: string;
    readonly entity: string;
    readonly type: string;
    readonly [key: string]: unknown;
}

export class ContractActionsResource {
    constructor(private readonly client: FetchClient) {}

    async list(): Promise<ContractActionDefinition[]> {
        return await this.client.get('/contract/actions', undefined, { operationId: 'listActions' });
    }

    async get(name: string): Promise<ContractActionDefinition> {
        return await this.client.get(`/contract/actions/${encodeURIComponent(name)}`, undefined, { operationId: 'getAction' });
    }

    async create(input: ContractActionWriteInput): Promise<ContractActionDefinition> {
        return await this.client.post('/contract/actions', input, { operationId: 'createAction' });
    }

    async put(name: string, input: ContractActionWriteInput): Promise<ContractActionDefinition> {
        return await this.client.put(`/contract/actions/${encodeURIComponent(name)}`, input, { operationId: 'replaceAction' });
    }

    async patch(name: string, patch: ContractActionPatchInput): Promise<ContractActionDefinition> {
        return await this.client.patch(`/contract/actions/${encodeURIComponent(name)}`, patch, { operationId: 'patchAction' });
    }

    /** `ContractDeletedAck`, not `void`: this route answers `{success, data: {message}}`. */
    async delete(name: string): Promise<ContractDeletedAck> {
        return await this.client.del<ContractDeletedAck>(`/contract/actions/${encodeURIComponent(name)}`, { operationId: 'deleteAction' });
    }
}
