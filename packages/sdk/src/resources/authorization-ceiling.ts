// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// Owner/ceiling envelope introspection.
//
// Read-only mirror of `GET /contract/authorizations/ceiling`. The envelope is
// the tenant's owner role names + the contract-section/system grants they
// hold — the ceiling a UI can compare other roles' grants against. The server
// computes it; the SDK only reads it.

import type { FetchClient } from '../_internal/fetch-client';

export type EnvelopeGrantKind = 'section' | 'system';

export interface EnvelopeGrant {
    readonly kind: EnvelopeGrantKind;
    /** Section name for kind='section'; null for kind='system'. */
    readonly target: string | null;
    readonly action: string;
    /** Bounds only (system grants) — not part of grant identity. */
    readonly conditions?: unknown;
}

export interface OwnerCeilingEnvelope {
    readonly ownerRoleNames: ReadonlyArray<string>;
    readonly grants: ReadonlyArray<EnvelopeGrant>;
}

export class AuthorizationCeilingResource {
    constructor(private readonly client: FetchClient) {}

    /**
     * GET /contract/authorizations/ceiling — the tenant's owner/ceiling envelope.
     * This endpoint returns the BARE `{ownerRoleNames, grants}` body (no
     * {success,data} wrapper), so it opts out of the transport unwrap.
     */
    async get(): Promise<OwnerCeilingEnvelope> {
        return await this.client.get<OwnerCeilingEnvelope>(
            '/contract/authorizations/ceiling',
            undefined,
            { operationId: 'getAuthorizationCeiling' },
        );
    }
}
