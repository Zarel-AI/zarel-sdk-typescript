// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// The public `conversation.turn_created` types are codegen-derived, not
// a second hand-authored source of truth. This is a COMPILE-TIME assertion: the
// public `ConversationTurnCreatedData` / `ConversationTurnCreatedPayload` must be mutually
// assignable with the generated OpenAPI schema types, and a value narrowed by the
// hand-authored runtime guard must be assignable to the public type. If the alias
// is dropped (types diverge), this file fails to type-check → the suite fails.
import type { components } from '../src/generated/runtime';
import {
    isConversationTurnCreatedData,
    type ConversationTurnCreatedData,
    type ConversationTurnCreatedPayload,
} from '../src/types/events-stream';

type GenData = components['schemas']['RuntimeSseConversationTurnCreatedData'];
type GenPayload = components['schemas']['RuntimeSseConversationTurnCreatedPayload'];

// Mutual assignability (≅ identity) between the public alias and the generated type.
type Extends<A, B> = A extends B ? true : false;
const _dataFwd: Extends<ConversationTurnCreatedData, GenData> = true;
const _dataBack: Extends<GenData, ConversationTurnCreatedData> = true;
const _payloadFwd: Extends<ConversationTurnCreatedPayload, GenPayload> = true;
const _payloadBack: Extends<GenPayload, ConversationTurnCreatedPayload> = true;
void _dataFwd; void _dataBack; void _payloadFwd; void _payloadBack;

describe('conversation.turn_created types are codegen-derived', () => {
    it('a guard-narrowed value is assignable to the generated schema type', () => {
        const raw: unknown = {
            entity: 'conversation/turns',
            record_id: 's1#1',
            timestamp: '2026-06-18T00:00:00.000Z',
            payload: { session_key: 's1', turn_number: 1, role: 'assistant' },
        };
        expect(isConversationTurnCreatedData(raw)).toBe(true);
        if (isConversationTurnCreatedData(raw)) {
            // `raw` narrows to ConversationTurnCreatedData; assigning to the generated type
            // only compiles if the alias holds.
            const asGenerated: GenData = raw;
            expect(asGenerated.payload.turn_number).toBe(1);
        }
    });
});
