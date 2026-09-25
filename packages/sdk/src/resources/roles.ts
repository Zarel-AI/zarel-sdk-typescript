// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
import { type FetchClient, localeQuery } from '../_internal/fetch-client';
import type { LocaleOptions } from '../types/locale';
import type { RolePayload, RoleCreatePayload, RoleWritePayload } from '../generated';

/**
 * Generated from the contract API's OpenAPI document; the stable consumer-facing names are kept.
 *
 * Neither type offers `label` or `description`: a role's labels and descriptions are written by
 * a contract publish, and the route refuses both by name with a 400.
 */
export type RoleRecord = RolePayload;
export type RoleCreateInput = RoleCreatePayload;
export type RoleUpdatePatch = RoleWritePayload;

/**
 * CRUD over the role definitions the tenant declares outside (or alongside)
 * a YAML import. Maps to the `/contract/roles` routes.
 *
 * Role assignments live on `/runtime/roles/assignments` and are exposed
 * via `RoleAssignmentsResource` — a separate resource, not a sub-method of
 * this one (see role-assignments.ts).
 */
export class RolesResource {
    constructor(private readonly client: FetchClient) {}

    async list(options?: LocaleOptions): Promise<RoleRecord[]> {
        return await this.client.get<RoleRecord[]>('/contract/roles', localeQuery(options), { operationId: 'listRoles' });
    }

    /** Read a single role definition by name. */
    async get(name: string, options?: LocaleOptions): Promise<RoleRecord> {
        return await this.client.get<RoleRecord>(`/contract/roles/${encodeURIComponent(name)}`, localeQuery(options), { operationId: 'getRole' });
    }

    async create(input: RoleCreateInput): Promise<RoleRecord> {
        return await this.client.post<RoleRecord>('/contract/roles', input, { operationId: 'createRole' });
    }

    /**
     * Replace a role definition wholesale (PUT). {@link update} is the partial (PATCH) counterpart.
     *
     * `RoleUpdatePatch`, not `RoleCreateInput`: the document publishes `RoleWrite` on BOTH verbs,
     * and `PUT` here is a MERGE rather than a total replace, so the
     * create shape — which requires `name` — was never what this operation accepts.
     */
    async put(name: string, input: RoleUpdatePatch): Promise<RoleRecord> {
        return await this.client.put<RoleRecord>(`/contract/roles/${encodeURIComponent(name)}`, input, { operationId: 'replaceRole' });
    }

    async update(name: string, patch: RoleUpdatePatch): Promise<RoleRecord> {
        return await this.client.patch<RoleRecord>(`/contract/roles/${encodeURIComponent(name)}`, patch, { operationId: 'patchRole' });
    }

    async delete(name: string): Promise<void> {
        await this.client.del(`/contract/roles/${encodeURIComponent(name)}`, { operationId: 'deleteRole' });
    }
}
