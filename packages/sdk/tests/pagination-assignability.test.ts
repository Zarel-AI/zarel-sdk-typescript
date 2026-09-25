// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// Compile-time assignability check.
//
// Each paginated `list` call must remain ASSIGNABLE to its original
// `Promise<Page>` return type. ts-jest type-checks this file, so a regression
// (a return type that is no longer assignable to `Promise<Page>`) makes the
// suite fail to compile — that is the check.
import { Zarel } from '../src/client';
import type { RecordListResponse } from '../src/types/records';
import type { TraceListResponse } from '../src/types/traces';
import type { ConversationSessionListResponse } from '../src/types/conversation-sessions';

// Never invoked — exists purely for the compile-time assignability assertions.

function _assignableToPromiseOfPage(client: Zarel): void {
    const records: Promise<RecordListResponse> = client.runtime.records.list('orders');
    const traces: Promise<TraceListResponse> = client.runtime.traces.list();
    const sessions: Promise<ConversationSessionListResponse> = client.runtime.conversation.sessions.list();
    void records;
    void traces;
    void sessions;
}

describe('list() return types stay assignable to Promise<Page>', () => {
    it('compiles (the assignment above is the real check)', () => {
        expect(typeof _assignableToPromiseOfPage).toBe('function');
    });
});
