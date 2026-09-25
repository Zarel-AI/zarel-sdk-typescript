// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
import { type FetchClient, localeQuery } from '../_internal/fetch-client';
import type {
    EntityInput,
    EntityReplaceInput,
    EntityWriteInput,
    FieldDefinitionInput,
    FieldReplaceInput,
    FieldWriteInput,
} from '../types/entities';
import type { ContractDeletedAck } from '../types/flows-contract';
import type { LocaleOptions } from '../types/locale';
import type {
    EntityFieldListPayload,
    EntityFieldPayload,
    EntityFieldRecordPayload,
    EntityListPayload,
    EntityPayload,
    EntityRecordPayload,
    FieldTransitionPayload,
    FieldTransitionCreatePayload,
    FieldTransitionWritePayload,
    FieldTransitionPatchPayload,
} from '../generated';

/**
 * `/contract/entities*`.
 *
 * Every return type here is derived from the contract API's OpenAPI document.
 */
export class EntitiesResource {
    constructor(private readonly client: FetchClient) {}

    /**
     * List all entities for the current tenant.
     * Pass `{locale: 'es'}` to receive Spanish labels; omit for
     * server-side fallback (JWT preferences.language → canonical).
     */
    async list(options?: LocaleOptions): Promise<EntityListPayload> {
        return await this.client.get<EntityListPayload>('/contract/entities', localeQuery(options), { operationId: 'listEntities' });
    }

    /**
     * Create a new entity.
     *
     * `label` and `description` are REFUSED with 400: semantic content is written by a contract
     * publish, never here.
     */
    async create(input: EntityInput): Promise<EntityRecordPayload> {
        return await this.client.post<EntityRecordPayload>('/contract/entities', input, { operationId: 'createEntity' });
    }

    /**
     * Get a single entity by name.
     */
    async get(entityName: string, options?: LocaleOptions): Promise<EntityPayload> {
        return await this.client.get<EntityPayload>(`/contract/entities/${entityName}`, localeQuery(options), { operationId: 'getEntity' });
    }

    /**
     * Merge-patch an entity: an absent key is left alone, an explicit `null` clears it.
     */
    async update(entityName: string, input: EntityWriteInput): Promise<EntityRecordPayload> {
        return await this.client.patch<EntityRecordPayload>(`/contract/entities/${entityName}`, input, { operationId: 'patchEntity' });
    }

    /** `ContractDeletedAck`, not `void`: this route answers `{success, data: {message}}`. */
    async delete(entityName: string): Promise<ContractDeletedAck> {
        return await this.client.del<ContractDeletedAck>(`/contract/entities/${entityName}`, { operationId: 'deleteEntity' });
    }

    /**
     * Add a field to an entity.
     *
     * The body is validated by the same rules a contract publish applies, so this reaches the SAME
     * verdict a publish of the equivalent YAML does — including the type-linked `constraints` check
     * and the `binding` forms.
     */
    async addField(entityName: string, field: FieldDefinitionInput): Promise<EntityFieldRecordPayload> {
        return await this.client.post<EntityFieldRecordPayload>(`/contract/entities/${entityName}/fields`, field, { operationId: 'createEntityField' });
    }

    /**
     * Merge-patch a field. Judged on the field the patch LEAVES BEHIND, so a `constraints` block
     * added without restating the type is validated against the STORED type.
     */
    async updateField(entityName: string, fieldName: string, update: FieldWriteInput): Promise<EntityFieldRecordPayload> {
        return await this.client.patch<EntityFieldRecordPayload>(`/contract/entities/${entityName}/fields/${fieldName}`, update, { operationId: 'patchEntityField' });
    }

    /** `ContractDeletedAck`, not `void`: this route answers `{success, data: {message}}`. */
    async deleteField(entityName: string, fieldName: string): Promise<ContractDeletedAck> {
        return await this.client.del<ContractDeletedAck>(`/contract/entities/${entityName}/fields/${fieldName}`, { operationId: 'deleteEntityField' });
    }

    /**
     * Replace an entity wholesale (PUT). {@link update} is the partial (PATCH) counterpart.
     *
     * A TOTAL write: every mutable declaration is REQUIRED, and `null` is how one is cleared. It
     * does not clear by omission, because no read on this surface returns those five declarations —
     * see `EntityReplaceInput`.
     */
    async replace(entityName: string, input: EntityReplaceInput): Promise<EntityRecordPayload> {
        return await this.client.put<EntityRecordPayload>(`/contract/entities/${entityName}`, input, { operationId: 'replaceEntity' });
    }

    /**
     * List an entity's fields. The response is `{entity_name, fields}` — the field array is nested
     * under `fields` (the endpoint wraps it, unlike the transition/step lists).
     */
    async listFields(entityName: string, options?: LocaleOptions): Promise<EntityFieldListPayload> {
        return await this.client.get<EntityFieldListPayload>(`/contract/entities/${entityName}/fields`, localeQuery(options), { operationId: 'listEntityFields' });
    }

    /**
     * Read a single field definition — the SAME shape the collection and the entity detail carry.
     */
    async getField(entityName: string, fieldName: string, options?: LocaleOptions): Promise<EntityFieldPayload> {
        return await this.client.get<EntityFieldPayload>(`/contract/entities/${entityName}/fields/${fieldName}`, localeQuery(options), { operationId: 'getEntityField' });
    }

    /**
     * Replace a field wholesale (PUT). {@link updateField} is the partial (PATCH) counterpart.
     *
     * A TOTAL write — every mutable property is REQUIRED and `null` clears; see
     * `FieldReplaceInput`.
     */
    async replaceField(entityName: string, fieldName: string, input: FieldReplaceInput): Promise<EntityFieldRecordPayload> {
        return await this.client.put<EntityFieldRecordPayload>(`/contract/entities/${entityName}/fields/${fieldName}`, input, { operationId: 'replaceEntityField' });
    }

    // ── Field transitions — state-machine rules on a field, addressed by (entity, field, from, to) ──

    async listFieldTransitions(entityName: string, fieldName: string, options?: LocaleOptions): Promise<FieldTransitionPayload[]> {
        return await this.client.get<FieldTransitionPayload[]>(`/contract/entities/${entityName}/fields/${fieldName}/transitions`, localeQuery(options), { operationId: 'listFieldTransitions' });
    }

    async getFieldTransition(entityName: string, fieldName: string, from: string, to: string, options?: LocaleOptions): Promise<FieldTransitionPayload> {
        return await this.client.get<FieldTransitionPayload>(`/contract/entities/${entityName}/fields/${fieldName}/transitions/${from}/${to}`, localeQuery(options), { operationId: 'getFieldTransition' });
    }

    async createFieldTransition(entityName: string, fieldName: string, input: FieldTransitionCreatePayload): Promise<FieldTransitionPayload> {
        return await this.client.post<FieldTransitionPayload>(`/contract/entities/${entityName}/fields/${fieldName}/transitions`, input, { operationId: 'createFieldTransition' });
    }

    async replaceFieldTransition(entityName: string, fieldName: string, from: string, to: string, input: FieldTransitionWritePayload): Promise<FieldTransitionPayload> {
        return await this.client.put<FieldTransitionPayload>(`/contract/entities/${entityName}/fields/${fieldName}/transitions/${from}/${to}`, input, { operationId: 'replaceFieldTransition' });
    }

    async patchFieldTransition(entityName: string, fieldName: string, from: string, to: string, patch: FieldTransitionPatchPayload): Promise<FieldTransitionPayload> {
        return await this.client.patch<FieldTransitionPayload>(`/contract/entities/${entityName}/fields/${fieldName}/transitions/${from}/${to}`, patch, { operationId: 'patchFieldTransition' });
    }

    /** `ContractDeletedAck`, not `void`: this route answers `{success, data: {message}}`. */
    async deleteFieldTransition(entityName: string, fieldName: string, from: string, to: string): Promise<ContractDeletedAck> {
        return await this.client.del<ContractDeletedAck>(`/contract/entities/${entityName}/fields/${fieldName}/transitions/${from}/${to}`, { operationId: 'deleteFieldTransition' });
    }
}
