// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
/**
 * WHAT A CALLER CAN SPELL on the authorization grant surface — compile-time facts.
 *
 * The grant write operations publish a generic JSON-object request body, which
 * openapi-typescript renders `Record<string, never>` — a body type admitting no key at all. So
 * the SDK's description of this wire is `AuthorizationStatement` in `resources/authorization.ts`,
 * derived from the published per-family statement schemas through the generated types, with no
 * hand-written copy of the vocabulary. These are the assertions that the derivation actually
 * NARROWS: a type admitting everything would pass every runtime test in this package.
 *
 * ══ TWO WAYS A CLAUSE LIKE THIS PROVES NOTHING ══
 *
 * `as T` IS NOT AN ASSIGNMENT. `void (() => ({…}) as AuthorizationStatement)` leaves every
 * `@ts-expect-error` directive unused: an assertion tells the compiler what the value is instead
 * of asking. The clauses below are annotated bindings, which is the form that actually checks.
 *
 * TS-JEST CACHES ON THE TEST FILE'S BYTES. A type-level clause in an unchanged file can keep
 * reporting a verdict about a type that has since moved, so run this file with `--no-cache`
 * before believing it.
 *
 * ══ WHAT THIS FILE HOLDS, AND WHAT IT DOES NOT ══
 *
 * Under a looser `string | Record<string, {fields?, scope?, when?}>` the FOUR qualifier-value
 * directives stay in use: that type constrains `fields` to a string array and `scope` to the
 * plane enum. What it does not constrain is the KEY SPACE — any string as a bare action, and any
 * string as an attenuation key — and those are the two directives that go unused under it. The
 * value shapes are held by the published schemas the generated types are derived from.
 */
import { Zarel } from '../src/client';
import { grantQualifiers } from '../src';
import type { AuthorizationStatement, AuthorizationGrantCreate } from '../src';

describe('the grant statement vocabulary is a closed set at the call site', () => {
    it('an action outside every family does not compile, bare or as a key', () => {
        // @ts-expect-error `delete_everything` is in no family's action vocabulary
        const bogusBare: AuthorizationStatement = 'delete_everything';
        // @ts-expect-error the attenuated form is keyed by the action enum, not by any string
        const bogusKey: AuthorizationStatement = { delete_everythig: {} };
        // …and the real ones still compile, which is what stops this clause passing on a type
        // that admits nothing.
        const bare: AuthorizationStatement = 'read';
        const attenuated: AuthorizationStatement = { update: { fields: ['status'] } };
        const scoped: AuthorizationStatement = { use: { scope: ['runtime'] } };
        expect([bogusBare, bogusKey, bare, attenuated, scoped]).toHaveLength(5);
    });

    it('a qualifier value of the wrong shape does not compile', () => {
        // Four qualifier values of the wrong shape. Every one is unspellable.
        // @ts-expect-error `fields` is a string array, not a bare string
        const stringFields: AuthorizationStatement = { update: { fields: 'oops' } };
        // @ts-expect-error `fields` members are strings, not numbers
        const numberFields: AuthorizationStatement = { update: { fields: [1, 2] } };
        // @ts-expect-error `scope` is a closed two-member plane enum
        const badScope: AuthorizationStatement = { use: { scope: ['nope'] } };
        // @ts-expect-error `scope` is an array, not a bare plane
        const bareScope: AuthorizationStatement = { use: { scope: 'runtime' } };
        expect([stringFields, numberFields, badScope, bareScope]).toHaveLength(4);
    });

    /**
     * THE PAIRING IS A DOCUMENT RULE AND NOT A TYPE RULE, stated because the opposite is the
     * obvious thing to assume from a four-branch `oneOf`.
     *
     * `ContractGrantCreateBody` publishes one branch per family, and the server enforces it
     * exactly: a config `on` with a records action matches no branch and is refused.
     *
     * TypeScript cannot follow it. The config branch pins `on` to the `ContractSectionName` enum,
     * but the three operational branches published `on` as a `pattern`, and openapi-typescript
     * renders a `pattern` as a bare `string` — so `{on: 'entities', actions: ['create']}` fails
     * the config branch and then satisfies the RECORDS branch, whose `on` accepts any string.
     *
     * A `@ts-expect-error` claiming the pairing does not compile is reported unused by `tsc`, so
     * this clause asserts that it compiles.
     */
    it('the create pairing compiles, and it is the DOCUMENT that refuses it', () => {
        const mismatched: AuthorizationGrantCreate = { on: 'entities', actions: ['create'] };
        const wellFormed: AuthorizationGrantCreate = { on: 'records/orders', actions: ['create'] };
        expect([mismatched, wellFormed]).toHaveLength(2);
    });

    /**
     * `grantQualifiers` — the accessor the narrowing MADE NECESSARY, and the reason it is a
     * function rather than three casts.
     *
     * `Object.values(statement)[0]?.scope` is `any` under the closed per-family union: `{use?: Q}`
     * does not match `Object.values`' index-signature overload, so it falls through to the `{}`
     * one — and `tsc` does not flag the untyped read.
     *
     * Both halves are asserted: the VALUE it returns, and that the value is typed (a `scope` read
     * off an `any` would satisfy the first half and nothing else).
     */
    it('grantQualifiers reads the single key\'s bag, typed, for every family', () => {
        expect(grantQualifiers('read')).toBeUndefined();
        expect(grantQualifiers({ update: { fields: ['status'] } })).toEqual({ fields: ['status'] });
        expect(grantQualifiers({ use: { scope: ['runtime'] } })).toEqual({ scope: ['runtime'] });
        expect(grantQualifiers({ read: {} })).toEqual({});

        // TYPED, not `any`: each read is annotated, so a return that decayed to `any` would still
        // pass the equalities above and these bindings would stop meaning anything only if the
        // annotations were dropped. `@ts-expect-error` is what proves the type is closed.
        const scope: ReadonlyArray<'contract' | 'runtime'> | undefined =
            grantQualifiers({ use: { scope: ['contract'] } })?.scope;
        const fields: ReadonlyArray<string> | undefined =
            grantQualifiers({ update: { fields: ['a'] } })?.fields;
        expect({ scope, fields }).toEqual({ scope: ['contract'], fields: ['a'] });
        // @ts-expect-error `zz_not_a_qualifier` is in no family's qualifier vocabulary
        void grantQualifiers({ read: {} })?.zz_not_a_qualifier;
    });

    it('the narrowed types still drive a real call', async () => {
        // The negative control for every clause above: a type admitting NOTHING would satisfy all
        // the `@ts-expect-error` lines and break every caller. This one is a round trip.
        const fetchFn = jest.fn<Promise<Response>, [string | URL | Request, RequestInit?]>()
            .mockResolvedValue({
                ok: true, status: 200, headers: new Headers(),
                json: () => Promise.resolve({ success: true, data: { on: 'records/orders', actions: ['read'] } }),
            } as Response);
        const zarel = new Zarel({ tenant: 'acme', contractToken: 'ct', fetch: fetchFn });
        const grant = await zarel.contract.authorization.put('support', 'records/orders', [
            { update: { fields: ['status'] } },
        ]);
        expect(grant).toEqual({ on: 'records/orders', actions: ['read'] });
    });
});
