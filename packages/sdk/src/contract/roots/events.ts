// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// contract.events.delivery — the event-delivery config document.
// Mirrors `/contract/events/delivery` (distinct from the top-level
// `contract.events.rules` section — the HTTP surface splits them the same way).

import type { FetchClient } from '../../_internal/fetch-client';
import { SingletonAccessor } from '../_singleton';

export class ContractRuntimeEventsResource {
    readonly delivery: SingletonAccessor;
    constructor(client: FetchClient) {
        this.delivery = new SingletonAccessor(client, '/contract/events/delivery', {
            get: 'getEventsDeliveryConfig',
            put: 'putEventsDeliveryConfig',
            patch: 'patchEventsDeliveryConfig',
        });
    }
}
