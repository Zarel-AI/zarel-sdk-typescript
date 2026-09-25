// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// Shared accessor for contract-API sections that are a single document
// (the process-model document, the contract roots that carry one, events/delivery).
// Each is one JSON document with get/put/patch.

import type { FetchClient } from '../_internal/fetch-client';

/**
 * Any JSON object: the default document type of `SingletonAccessor`, exported so every
 * section accessor names the same type.
 */
export type JsonObject = Record<string, unknown>;

export interface SingletonOperationIds {
    readonly get: string;
    readonly put: string;
    readonly patch: string;
}

/**
 * `Doc` / `Write` default to `JsonObject`, which says nothing, in both directions. A section
 * that has a published schema names it here instead.
 *
 * `/contract/llm` and `/contract/process-model` are typed on the write: each takes the section
 * MINUS a child that has its own endpoints, a type derived from the section's own schema.
 * `/contract/events/delivery` is the one still on the default.
 *
 * THE READS ARE STILL `JsonObject` ON THOSE TWO, which is not an oversight: `getLlm` and
 * `getProcessModel` publish a bare `OkEnvelope`, so there is no read shape to point at, and a
 * `Write` type doubling as a `Doc` would claim a response body nothing binds.
 *
 * `Doc` and `Write` are SEPARATE parameters because a read and a write are not the same
 * shape: `/contract/treatment` answers a `vocabulary` its own PUT refuses.
 *
 * `Patch` IS A THIRD, and it defaults to `Write` for sections with no separate patch body. A
 * replace and an RFC 7396 merge patch are not the same body either: the patch requires nothing
 * (the required key comes from the merge base) and it admits `null`, which REMOVES a key and is
 * the only way to clear one. Typed as `Write`, `patch({})` would not compile on a route that
 * answers 200, and neither would `patch({temperature: null})`, the only spelling that clears a
 * tunable.
 */
export class SingletonAccessor<Doc = JsonObject, Write = JsonObject, Patch = Write> {
    constructor(
        private readonly client: FetchClient,
        private readonly path: string,
        private readonly operationIds: SingletonOperationIds,
    ) {}

    async get(): Promise<Doc> {
        return await this.client.get<Doc>(this.path, undefined, { operationId: this.operationIds.get });
    }

    async put(input: Write): Promise<Doc> {
        return await this.client.put<Doc>(this.path, input, { operationId: this.operationIds.put });
    }

    async patch(patch: Patch): Promise<Doc> {
        return await this.client.patch<Doc>(this.path, patch, { operationId: this.operationIds.patch });
    }
}
