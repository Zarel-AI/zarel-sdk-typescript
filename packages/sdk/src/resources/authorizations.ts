// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// Self-scoped effective-authorizations introspection.

import type { FetchClient } from '../_internal/fetch-client';

export interface EntityPermissionEntry {
    readonly entity: string;
    readonly actions: ReadonlyArray<string>;
    /**
     * The scope the server enforces, per reported action. `full` reaches every row;
     * `owner` reaches only rows the caller owns.
     *
     * An owner-scoped action is listed in `actions` like any other, so gate a ROW-level
     * affordance on this map, not on `actions.includes(...)` alone.
     */
    readonly scope_by_action: Readonly<Record<string, 'full' | 'owner'>>;
    /**
     * Per-action writable field restriction, ON A ROW THE CALLER OWNS — the widest set any
     * single row admits. **Absent = all fields**; it never means none.
     */
    readonly fields_by_action: Readonly<Record<string, ReadonlyArray<string> | null>>;
}

export interface EffectiveAuthorizationsResponse {
    readonly tenant_name: string;
    readonly user_name: string;
    readonly user_roles: ReadonlyArray<string>;
    readonly admin_sections: ReadonlyArray<string>;
    readonly system_actions: ReadonlyArray<string>;
    readonly entity_permissions: ReadonlyArray<EntityPermissionEntry>;
}

export class AuthorizationsResource {
    constructor(private readonly client: FetchClient) {}

    /**
     * GET /runtime/authorizations/effective — what the authorization engine
     * decides for the CALLING actor (self-scope; no actor parameter exists).
     */
    async effective(): Promise<EffectiveAuthorizationsResponse> {
        return await this.client.get<EffectiveAuthorizationsResponse>('/runtime/authorizations/effective', undefined, { operationId: 'runtimeEffectiveAuthorizations' });
    }
}
