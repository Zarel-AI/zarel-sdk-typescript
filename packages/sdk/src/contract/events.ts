// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// contract.admin.eventsRules CRUD.
// Maps to the contract API's `/contract/events/rules` routes (the unified event-condition-action model).

import type { FetchClient } from '../_internal/fetch-client';
import type { EventRulePatch, EventRuleRecord, EventRuleWrite } from '../types/mcp-and-events-contract';
import type { ContractDeletedAck } from '../types/flows-contract';
import { SingletonAccessor } from './_singleton';

export type { EventRulePatch, EventRuleRecord, EventRuleWrite };

export class EventsRulesResource {
    constructor(private readonly client: FetchClient) {}

    async list(): Promise<EventRuleRecord[]> {
        return await this.client.get('/contract/events/rules', undefined, { operationId: 'listEventRules' });
    }

    async get(name: string): Promise<EventRuleRecord> {
        return await this.client.get(`/contract/events/rules/${encodeURIComponent(name)}`, undefined, { operationId: 'getEventRule' });
    }

    async create(input: EventRuleWrite): Promise<EventRuleRecord> {
        return await this.client.post('/contract/events/rules', input, { operationId: 'createEventRule' });
    }

    async put(name: string, input: EventRuleWrite): Promise<EventRuleRecord> {
        return await this.client.put(`/contract/events/rules/${encodeURIComponent(name)}`, input, { operationId: 'replaceEventRule' });
    }

    async patch(name: string, patch: EventRulePatch): Promise<EventRuleRecord> {
        return await this.client.patch(`/contract/events/rules/${encodeURIComponent(name)}`, patch, { operationId: 'patchEventRule' });
    }

    async delete(name: string): Promise<ContractDeletedAck> {
        return await this.client.del<ContractDeletedAck>(`/contract/events/rules/${encodeURIComponent(name)}`, { operationId: 'deleteEventRule' });
    }
}

/**
 * `contract.events.*` — the top-level `events` section. Today it exposes the
 * `rules` collection; the wrapper mirrors the HTTP nesting `/contract/events/rules`.
 */
export class ContractEventsResource {
    readonly rules: EventsRulesResource;
    /**
     * The delivery config is the `events.delivery` section of the contract, so it belongs HERE,
     * under `events`, and `contract.events.delivery` is a prefix of the HTTP path.
     */
    readonly delivery: SingletonAccessor;
    constructor(client: FetchClient) {
        this.rules = new EventsRulesResource(client);
        this.delivery = new SingletonAccessor(client, '/contract/events/delivery', {
            get: 'getEventsDeliveryConfig',
            put: 'putEventsDeliveryConfig',
            patch: 'patchEventsDeliveryConfig',
        });
    }
}
