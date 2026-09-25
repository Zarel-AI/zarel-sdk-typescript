// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// conversation.sessions bare-array auto-pagination.
import { Zarel } from '../../src/client';
import type { ConversationSessionSummary } from '../../src/types/conversation-sessions';

type MockFetch = jest.Mock<Promise<Response>, [input: string | URL | Request, init?: RequestInit]>;

function jsonResponse(data: unknown): Response {
    return {
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, data }),
        headers: new Headers(),
    } as Response;
}

function makeZarel(fetchFn: MockFetch): Zarel {
    return new Zarel({
        runtimeToken: 'test-token',
        runtimeBaseUrl: 'https://api.test.com/v1',
        maxRetries: 0,
        fetch: fetchFn,
    });
}

function summary(key: string): ConversationSessionSummary {
    return {
        tenant_name: 't',
        session_key: key,
        user_name: 'u',
        channel_name: 'desk',
        status: 'active',
        turn_count: 0,
        created_at: '2026-01-01T00:00:00Z',
        last_activity: '2026-01-01T00:00:00Z',
    };
}

function offsetOf(call: [input: string | URL | Request, init?: RequestInit]): number {
    return Number(new URL(call[0] as string).searchParams.get('offset') ?? '0');
}

describe('conversation.sessions — bare-array auto-pagination', () => {
    afterEach(() => jest.restoreAllMocks());

    it('advances by page size and stops on a short page', async () => {
        const pages: Record<number, ConversationSessionSummary[]> = {
            0: [summary('a'), summary('b')],
            2: [summary('c')],
        };
        const fetchFn: MockFetch = jest.fn((input) => {
            const offset = Number(new URL(input as string).searchParams.get('offset') ?? '0');
            return Promise.resolve(jsonResponse(pages[offset] ?? []));
        });
        const zarel = makeZarel(fetchFn);

        const keys: string[] = [];
        for await (const s of zarel.runtime.conversation.sessions.list({ limit: 2 })) keys.push(s.session_key);

        expect(keys).toEqual(['a', 'b', 'c']);
        expect(fetchFn.mock.calls.map(offsetOf)).toEqual([0, 2]);
    });

    it('does one trailing empty fetch on an exact multiple, then stops', async () => {
        const pages: Record<number, ConversationSessionSummary[]> = {
            0: [summary('a'), summary('b')],
            2: [],
        };
        const fetchFn: MockFetch = jest.fn((input) => {
            const offset = Number(new URL(input as string).searchParams.get('offset') ?? '0');
            return Promise.resolve(jsonResponse(pages[offset] ?? []));
        });
        const zarel = makeZarel(fetchFn);

        const keys: string[] = [];
        for await (const s of zarel.runtime.conversation.sessions.list({ limit: 2 })) keys.push(s.session_key);

        expect(keys).toEqual(['a', 'b']);
        expect(fetchFn.mock.calls.map(offsetOf)).toEqual([0, 2]); // trailing empty fetch then stop
    });

    it('await returns the first bare-array page unchanged', async () => {
        const fetchFn: MockFetch = jest.fn<Promise<Response>, [input: string | URL | Request, init?: RequestInit]>(() => Promise.resolve(jsonResponse([summary('a')])));
        const zarel = makeZarel(fetchFn);
        const page = await zarel.runtime.conversation.sessions.list();
        expect(page).toEqual([summary('a')]);
        expect(fetchFn.mock.calls).toHaveLength(1);
    });
});
