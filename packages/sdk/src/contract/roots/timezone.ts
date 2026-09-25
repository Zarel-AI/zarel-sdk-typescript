// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// contract.timezone — the tenant runtime timezone singleton.
// GET/PUT only (no patch) on /contract/timezone (validated IANA id).

import type { FetchClient } from '../../_internal/fetch-client';
import type { ContractTimezoneWritePayload } from '../../generated';
import type { JsonObject } from '../_singleton';

export class TimezoneResource {
    constructor(private readonly client: FetchClient) {}

    async get(): Promise<JsonObject> {
        return await this.client.get('/contract/timezone', undefined, { operationId: 'getTimezone' });
    }

    // `{ timezone }` and nothing else — the route reads `timezone` and no other key.
    async put(input: ContractTimezoneWritePayload): Promise<JsonObject> {
        return await this.client.put('/contract/timezone', input, { operationId: 'putTimezone' });
    }
}
