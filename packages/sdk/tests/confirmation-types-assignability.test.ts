// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// The public confirmation types are an OpenAPI projection, not a
// second hand-authored source of truth. This is a COMPILE-TIME assertion: if the
// spec renames `guards`, adds a required field to a guard, or changes a type, the
// aliases below stop holding and this file fails to type-check → the suite fails.
//
// `guards` is asserted MUTUALLY assignable at the element level: one direction
// alone would let the spec grow a field the SDK silently drops (or the SDK invent
// one the server never sends).
import type { components } from '../src/generated/runtime';
import type { ConfirmationChallenge, ConfirmationGuard } from '../src/types/confirmation';
import { parseConfirmationChallenge } from '../src/_internal/confirmation';

type GenChallenge = NonNullable<
    NonNullable<
        components['responses']['ConfirmationRequired']['content']['application/json']['error']
    >['confirmation']
>;
type GenGuard = GenChallenge['guards'][number];

type Extends<A, B> = A extends B ? true : false;

const _guardFwd: Extends<ConfirmationGuard, GenGuard> = true;
const _guardBack: Extends<GenGuard, ConfirmationGuard> = true;
// The challenge's own fields. `token` is optional on the wire but REQUIRED here:
// the SDK surfaces a challenge only when it can be round-tripped, so the public
// type is the narrower one (assignable to the wire type, not from it).
const _guardsFwd: Extends<ConfirmationChallenge['guards'], readonly GenGuard[]> = true;
const _token: Extends<ConfirmationChallenge['token'], NonNullable<GenChallenge['token']>> = true;
const _expiresAt: Extends<ConfirmationChallenge['expires_at'], GenChallenge['expires_at']> = true;
void _guardFwd; void _guardBack; void _guardsFwd; void _token; void _expiresAt;

describe('confirmation types are codegen-derived', () => {
    it('a parsed challenge is assignable to the generated wire shape', () => {
        const wire: GenChallenge = {
            guards: [{ name: 'confirm_over_approval', prompt: 'Approve over the ceiling?' }],
            token: 'zct1.aaa.bbb',
            expires_at: '2026-07-27T12:00:00.000Z',
        };
        const parsed = parseConfirmationChallenge(wire);
        expect(parsed).toBeDefined();
        // Assigning back to the generated type only compiles if the alias holds.
        const roundTrip: GenChallenge = {
            guards: [...parsed!.guards],
            token: parsed!.token,
            expires_at: parsed!.expires_at,
        };
        expect(roundTrip).toEqual(wire);
    });
});
