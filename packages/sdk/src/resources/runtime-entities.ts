// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
import type { FetchClient } from '../_internal/fetch-client';

/**
 * What `POST /runtime/entities/{entity_name}/recompute` answers, and it is NOT DESCRIBED.
 *
 * `recomputeEntity` does not publish a response schema, so the honest type is an open object
 * that SAYS so, and it stops being this the moment the runtime document describes the operation.
 */
export type RecomputeResult = Record<string, unknown>;

/**
 * Runtime-plane entity operations.
 *
 * Only `recompute` lives here, and deliberately so: entity and
 * field AUTHORING live on the contract plane (`client.contract.entities`), because
 * those mutate contract state. Recompute mutates records, so it is a
 * runtime-plane verb and shares both behaviour and authorization with the MCP
 * `recompute_entity` tool.
 */
export class RuntimeEntitiesResource {
    constructor(private readonly client: FetchClient) {}

    /**
     * Recompute the derived fields of every record of an entity.
     */
    async recompute(entityName: string): Promise<RecomputeResult> {
        return await this.client.post<RecomputeResult>(
            `/runtime/entities/${encodeURIComponent(entityName)}/recompute`,
            undefined,
            { operationId: 'recomputeEntity' },
        );
    }
}
