// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
import { type FetchClient, localeQuery } from '../_internal/fetch-client';
import type { RoleAssignRequest } from '../types/platform';
import type { LocaleOptions } from '../types/locale';
import type { RoleAssignmentListPayload, RoleAssignmentPayload } from '../generated';

/**
 * Role assignments (runtime-scope, resource-shaped): CRUD over
 * `/runtime/roles/assignments`.
 */
export class RoleAssignmentsResource {
    constructor(private readonly client: FetchClient) {}

    async list(options?: LocaleOptions): Promise<RoleAssignmentListPayload> {
        return await this.client.get<RoleAssignmentListPayload>('/runtime/roles/assignments', localeQuery(options), { operationId: 'listRoleAssignments' });
    }

    /**
     * Assign a role to a user (canonical POST).
     *
     * The SDK input shape uses `target_user_name` to distinguish the
     * grantee from the calling actor; the API takes `user_name`, so the
     * body is mapped here at the wire boundary.
     */
    async create(request: RoleAssignRequest): Promise<RoleAssignmentPayload> {
        return await this.client.post<RoleAssignmentPayload>('/runtime/roles/assignments', {
            user_name: request.target_user_name,
            role_name: request.role_name,
            ...(request.expires_at !== undefined ? { expires_at: request.expires_at } : {}),
        }, { operationId: 'createRoleAssignment' });
    }

    /**
     * Revoke a role assignment (canonical DELETE by composite natural key).
     */
    async delete(userName: string, roleName: string): Promise<void> {
        await this.client.del(
            `/runtime/roles/assignments/${encodeURIComponent(userName)}/${encodeURIComponent(roleName)}`,
            { operationId: 'deleteRoleAssignment' },
        );
    }
}
