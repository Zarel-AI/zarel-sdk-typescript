// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
import { type FetchClient, localeQueryOrUndefined } from '../_internal/fetch-client';
import type { LocaleOptions } from '../types/locale';
import type {
    GrantCreatePayload,
    GrantQualifiersConfigPayload,
    GrantQualifiersFlowsPayload,
    GrantQualifiersLlmServicesPayload,
    GrantQualifiersRecordsPayload,
    GrantStatementConfigPayload,
    GrantStatementFlowsPayload,
    GrantStatementLlmServicesPayload,
    GrantStatementRecordsPayload,
} from '../generated';
import { authorizationOperationSuffix } from './authorization-operation-ids';

/**
 * The authorization surface.
 *
 * The HTTP surface is one path-addressed resource, so the SDK is one resource too.
 *
 * The on-path is NOT passed through `encodeURIComponent`: it travels as real path
 * segments, and an encoded `%2F` is decoded by the server before routing.
 * `{role}` is encoded: it is a single segment and a user-supplied value.
 */

/**
 * A grant statement: a bare action, or one attenuated by `fields` / `scope` / `when`.
 *
 * DERIVED from the published grant schemas, so the action vocabulary is closed: a misspelled
 * action does not type-check.
 *
 * A UNION OF THE FOUR FAMILIES rather than a per-family type, because `put`/`patch` take the
 * on-path as a `string` that the caller computes, and a type cannot narrow on a value it has
 * not seen. So this closes the ACTION vocabulary; which of the four families an on-path admits
 * is decided by the server.
 */
export type AuthorizationStatement =
    | GrantStatementConfigPayload
    | GrantStatementRecordsPayload
    | GrantStatementFlowsPayload
    | GrantStatementLlmServicesPayload;

/**
 * The `POST` body — one published branch per family, so the DOCUMENT states which actions pair
 * with which on-path and refuses a body that mixes them.
 *
 * TYPESCRIPT DOES NOT FOLLOW THE PAIRING: `{on: 'entities', actions: ['create']}` compiles.
 * Only the config branch pins `on` (to the `ContractSectionName` enum); the three operational
 * branches publish it as a `pattern`, which openapi-typescript renders as a bare `string` — so a
 * mismatched body fails the config branch and is then admitted by the records one. The rule is
 * enforced by the server, not by the caller's compiler; `authorization-statement-typing.test.ts`
 * pins this behaviour.
 *
 * What the type DOES close is the statement vocabulary — see {@link AuthorizationStatement}.
 */
export type AuthorizationGrantCreate = GrantCreatePayload;

/**
 * Every qualifier any family admits, as an INTERSECTION of the four published bags.
 *
 * All four declare their properties optional, so `{when?} & {fields?, when?} & {scope?}` is
 * inhabited by each of them and by nothing wider — it is the read type a caller holding a
 * statement of unknown family actually has. Derived, not restated.
 */
export type AuthorizationQualifiers =
    & GrantQualifiersConfigPayload
    & GrantQualifiersRecordsPayload
    & GrantQualifiersFlowsPayload
    & GrantQualifiersLlmServicesPayload;

/**
 * The qualifiers attenuating a statement, or `undefined` for a bare action.
 *
 * `Object.values(statement)[0]` does not keep its type: the object arm of each closed
 * per-family type is `{use?: Q}`, which does not match `Object.values`' index-signature
 * overload, so it falls through to the `{}` one and returns `any[]`. This helper reads the
 * qualifier bag with its type intact, so no call site needs a cast (a cast would silence the
 * `any` instead of removing it).
 */
export function grantQualifiers(
    statement: AuthorizationStatement,
): AuthorizationQualifiers | undefined {
    if (typeof statement === 'string') return undefined;
    const values = Object.values(statement as Record<string, AuthorizationQualifiers | undefined>);
    return values[0];
}

/** The permissions a role holds on one on-path — the addressable unit. */
export interface AuthorizationGrant {
    /** e.g. `entities`, `channels`, `records/orders`, `llm/services/primary`. */
    readonly on: string;
    readonly actions: ReadonlyArray<AuthorizationStatement>;
}

/** A role's complete grant set. */
export interface RoleAuthorization {
    readonly role: string;
    readonly grants: ReadonlyArray<AuthorizationGrant>;
}

/**
 * Authorization grants, addressed the way the contract declares them:
 * `/contract/authorization/{role}/<on-path>`.
 */
export class AuthorizationResource {
    constructor(private readonly client: FetchClient) {}

    private base(role: string): string {
        return `/contract/authorization/${encodeURIComponent(role)}`;
    }

    /** The on-path is a PATH, not a value to encode — that is the whole point. */
    private item(role: string, onPath: string): string {
        return `${this.base(role)}/${onPath}`;
    }

    private op(verb: 'get' | 'put' | 'patch' | 'delete', onPath: string): string {
        return `${verb}Grant${authorizationOperationSuffix(onPath)}`;
    }

    /** Every grant a role holds, in canonical order. */
    async list(role: string, options?: LocaleOptions): Promise<RoleAuthorization> {
        return await this.client.get<RoleAuthorization>(
            this.base(role),
            localeQueryOrUndefined(options),
            { operationId: 'listRoleGrants' },
        );
    }

    /** Read one grant. */
    async get(role: string, onPath: string, options?: LocaleOptions): Promise<AuthorizationGrant> {
        return await this.client.get<AuthorizationGrant>(
            this.item(role, onPath),
            localeQueryOrUndefined(options),
            { operationId: this.op('get', onPath) },
        );
    }

    /** Create a grant. Rejects with 409 when one already exists on that on-path — use {@link put} to replace. */
    async create(role: string, grant: AuthorizationGrantCreate): Promise<AuthorizationGrant> {
        return await this.client.post<AuthorizationGrant>(this.base(role), grant, { operationId: 'createRoleGrant' });
    }

    /** Create or replace a grant. Idempotent. */
    async put(role: string, onPath: string, actions: ReadonlyArray<AuthorizationStatement>): Promise<AuthorizationGrant> {
        return await this.client.put<AuthorizationGrant>(
            this.item(role, onPath), { actions }, { operationId: this.op('put', onPath) },
        );
    }

    /** Merge actions into an existing grant — adds or re-attenuates, never drops. */
    async patch(role: string, onPath: string, actions: ReadonlyArray<AuthorizationStatement>): Promise<AuthorizationGrant> {
        return await this.client.patch<AuthorizationGrant>(
            this.item(role, onPath), { actions }, { operationId: this.op('patch', onPath) },
        );
    }

    /** Remove a grant entirely. */
    async del(role: string, onPath: string): Promise<{ readonly message: string }> {
        return await this.client.del<{ readonly message: string }>(
            this.item(role, onPath), { operationId: this.op('delete', onPath) },
        );
    }
}
