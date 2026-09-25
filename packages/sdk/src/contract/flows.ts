// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// contract.flows CRUD.
//
// The typed SDK path for flow definitions (`GET/POST/PUT/DELETE /contract/flows`).
// Maps to the contract API's `/contract/flows` route family. Mirrors
// `SkillsResource`/`RolesResource` shape.
//
// THE RESPONSES ARE TYPED from the published schema. `types/flows-contract.ts` carries the
// derived types; an index signature would declare everything and therefore nothing.

import { type FetchClient, localeQuery } from '../_internal/fetch-client';
import type { LocaleOptions } from '../types/locale';
import type {
    ContractDeletedAck,
    ContractFlow,
    ContractFlowInput,
    ContractFlowPatchInput,
    // ALIASED: the class below already owns this name in this file, and the sub-resource is the
    // thing you call while the payload is the thing it answers.
    ContractFlowOnCompletion as ContractFlowOnCompletionEntry,
    ContractFlowOnCompletionCreate,
    ContractFlowOnCompletionWrite,
    ContractFlowStep,
    ContractFlowStepCreate,
    ContractFlowStepWrite,
} from '../types/flows-contract';

// Sub-resources of a flow definition. Each is bound to one flow and mirrors the
// `/contract/flows/{flow_name}/{steps,on-completion}` route families.
//
// BOTH DIRECTIONS ARE TYPED. The document publishes `FlowStepCreate`/`FlowStepWrite` and their
// on-completion siblings, so the request shapes below are derived from it like the responses.
//
// A caller passing a key the route does not declare fails to compile — which is the same fact
// the route answers 400 for.

class ContractFlowSteps {
    constructor(private readonly client: FetchClient, private readonly flow: string) {}

    private base(): string {
        return `/contract/flows/${encodeURIComponent(this.flow)}/steps`;
    }

    async list(options?: LocaleOptions): Promise<ContractFlowStep[]> {
        return await this.client.get<ContractFlowStep[]>(this.base(), localeQuery(options), { operationId: 'listFlowSteps' });
    }
    async get(name: string, options?: LocaleOptions): Promise<ContractFlowStep> {
        return await this.client.get<ContractFlowStep>(`${this.base()}/${encodeURIComponent(name)}`, localeQuery(options), { operationId: 'getFlowStep' });
    }
    async create(input: ContractFlowStepCreate): Promise<ContractFlowStep> {
        return await this.client.post<ContractFlowStep>(this.base(), input, { operationId: 'createFlowStep' });
    }
    async put(name: string, input: ContractFlowStepWrite): Promise<ContractFlowStep> {
        return await this.client.put<ContractFlowStep>(`${this.base()}/${encodeURIComponent(name)}`, input, { operationId: 'replaceFlowStep' });
    }
    async patch(name: string, patch: ContractFlowStepWrite): Promise<ContractFlowStep> {
        return await this.client.patch<ContractFlowStep>(`${this.base()}/${encodeURIComponent(name)}`, patch, { operationId: 'patchFlowStep' });
    }
    /** `ContractDeletedAck`, not `void`: this route answers `{success, data: {message}}`. */
    async delete(name: string): Promise<ContractDeletedAck> {
        return await this.client.del<ContractDeletedAck>(`${this.base()}/${encodeURIComponent(name)}`, { operationId: 'deleteFlowStep' });
    }
}

class ContractFlowOnCompletion {
    constructor(private readonly client: FetchClient, private readonly flow: string) {}

    private base(): string {
        return `/contract/flows/${encodeURIComponent(this.flow)}/on-completion`;
    }

    async list(options?: LocaleOptions): Promise<ContractFlowOnCompletionEntry[]> {
        return await this.client.get<ContractFlowOnCompletionEntry[]>(this.base(), localeQuery(options), { operationId: 'listFlowOnCompletion' });
    }
    async get(name: string, options?: LocaleOptions): Promise<ContractFlowOnCompletionEntry> {
        return await this.client.get<ContractFlowOnCompletionEntry>(`${this.base()}/${encodeURIComponent(name)}`, localeQuery(options), { operationId: 'getFlowOnCompletion' });
    }
    async create(input: ContractFlowOnCompletionCreate): Promise<ContractFlowOnCompletionEntry> {
        return await this.client.post<ContractFlowOnCompletionEntry>(this.base(), input, { operationId: 'createFlowOnCompletion' });
    }
    async put(name: string, input: ContractFlowOnCompletionWrite): Promise<ContractFlowOnCompletionEntry> {
        return await this.client.put<ContractFlowOnCompletionEntry>(`${this.base()}/${encodeURIComponent(name)}`, input, { operationId: 'replaceFlowOnCompletion' });
    }
    async patch(name: string, patch: ContractFlowOnCompletionWrite): Promise<ContractFlowOnCompletionEntry> {
        return await this.client.patch<ContractFlowOnCompletionEntry>(`${this.base()}/${encodeURIComponent(name)}`, patch, { operationId: 'patchFlowOnCompletion' });
    }
    /** `ContractDeletedAck`, not `void`: this route answers `{success, data: {message}}`. */
    async delete(name: string): Promise<ContractDeletedAck> {
        return await this.client.del<ContractDeletedAck>(`${this.base()}/${encodeURIComponent(name)}`, { operationId: 'deleteFlowOnCompletion' });
    }
}

export class ContractFlowsResource {
    constructor(private readonly client: FetchClient) {}

    async list(options?: LocaleOptions): Promise<ContractFlow[]> {
        return await this.client.get('/contract/flows', localeQuery(options), { operationId: 'listFlows' });
    }

    async get(name: string, options?: LocaleOptions): Promise<ContractFlow> {
        return await this.client.get(`/contract/flows/${encodeURIComponent(name)}`, localeQuery(options), { operationId: 'getFlow' });
    }

    async create(input: ContractFlowInput): Promise<ContractFlow> {
        return await this.client.post('/contract/flows', input, { operationId: 'createFlow' });
    }

    async update(name: string, input: ContractFlowInput): Promise<ContractFlow> {
        return await this.client.put(`/contract/flows/${encodeURIComponent(name)}`, input, { operationId: 'replaceFlow' });
    }

    /** Merge a partial change into a flow definition (PATCH). {@link update} is the wholesale (PUT) counterpart. */
    async patch(name: string, input: ContractFlowPatchInput): Promise<ContractFlow> {
        return await this.client.patch(`/contract/flows/${encodeURIComponent(name)}`, input, { operationId: 'patchFlow' });
    }

    /**
     * Delete a flow, and with it its steps, its on_completion entries and its
     * authorization policies.
     *
     * Running flow instances are left alone, the same way deleting an ENTITY definition leaves
     * its records in place.
     *
     * `ContractDeletedAck`, not `void`: this route answers `{success, data: {message}}`.
     */
    async delete(name: string): Promise<ContractDeletedAck> {
        return await this.client.del<ContractDeletedAck>(`/contract/flows/${encodeURIComponent(name)}`, { operationId: 'deleteFlow' });
    }

    /** A flow's steps, addressed by step `name`. */
    steps(flow: string): ContractFlowSteps {
        return new ContractFlowSteps(this.client, flow);
    }

    /** A flow's on-completion handlers, addressed by handler `name`. */
    onCompletion(flow: string): ContractFlowOnCompletion {
        return new ContractFlowOnCompletion(this.client, flow);
    }
}
