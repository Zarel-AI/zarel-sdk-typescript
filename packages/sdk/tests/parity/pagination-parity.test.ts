// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// Runtime golden-parity check.
//
// `await`-ing each paginated list call must resolve to the EXACT
// single-page shape the endpoint returns for the same request. The golden
// fixtures below are those awaited shapes.
import { Zarel } from '../../src/client';
import type { RecordListResponse } from '../../src/types/records';
import type { TraceListResponse } from '../../src/types/traces';
import type { ConversationSessionListResponse } from '../../src/types/conversation-sessions';

type MockFetch = jest.Mock<Promise<Response>, [input: string | URL | Request, init?: RequestInit]>;

function jsonResponse(data: unknown): Response {
    return {
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, data }),
        headers: new Headers(),
    } as Response;
}

function makeZarel(data: unknown): { zarel: Zarel; fetchFn: MockFetch } {
    const fetchFn: MockFetch = jest.fn<Promise<Response>, [input: string | URL | Request, init?: RequestInit]>(() =>
        Promise.resolve(jsonResponse(data)),
    );
    const zarel = new Zarel({
        runtimeToken: 'test-token',
        runtimeBaseUrl: 'https://api.test.com/v1',
        maxRetries: 0,
        fetch: fetchFn,
    });
    return { zarel, fetchFn };
}

describe('awaited list() matches the single-page shape', () => {
    afterEach(() => jest.restoreAllMocks());

    it('records.list — { records, total }', async () => {
        const golden: RecordListResponse = { records: [{ id: 1 }, { id: 2 }], total: 2 };
        const { zarel, fetchFn } = makeZarel(golden);
        const page = await zarel.runtime.records.list('orders', { limit: 50 });
        expect(page).toEqual(golden);
        expect(fetchFn.mock.calls).toHaveLength(1); // await fetches exactly one page
    });

    it('traces.list — { traces, next_cursor }', async () => {
        const golden: TraceListResponse = {
            traces: [{
                trace_id: 't1',
                started_at: '2026-01-01T00:00:00Z',
                completed_at: null,
                flow: null,
                user_name: 'u',
                duration_ms: null,
                // REQUIRED on TraceSummary: without it this fixture does not compile, and a
                // suite that fails to compile contributes zero tests to a run that reads
                // as passing.
                duration_basis: 'anchor_evidence',
                outcome: 'executed',
            }],
            next_cursor: 'cursor-2',
        };
        const { zarel, fetchFn } = makeZarel(golden);
        const page = await zarel.runtime.traces.list({ limit: 50 });
        expect(page).toEqual(golden);
        expect(fetchFn.mock.calls).toHaveLength(1);
    });

    it('conversation.sessions.list — ConversationSessionSummary[]', async () => {
        const golden: ConversationSessionListResponse = [{
            tenant_name: 't',
            session_key: 's1',
            user_name: 'u',
            channel_name: 'desk',
            status: 'active',
            turn_count: 3,
            created_at: '2026-01-01T00:00:00Z',
            last_activity: '2026-01-01T00:00:00Z',
        }];
        const { zarel, fetchFn } = makeZarel(golden);
        const page = await zarel.runtime.conversation.sessions.list({ limit: 50 });
        expect(page).toEqual(golden);
        expect(fetchFn.mock.calls).toHaveLength(1);
    });
});
