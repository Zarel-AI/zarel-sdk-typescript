// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// Stream lifecycle, event typing, reconnect, and
// terminal-vs-transient classification.
import { runEventStream, type ConnectOutcome } from '../src/_internal/sse-client';
import { FetchClient } from '../src/_internal/fetch-client';
import { isConversationTurnCreatedEvent, type RuntimeStreamEvent } from '../src/types/events-stream';
import { ZarelAuthError, ZarelAPIError } from '../src/errors';

const VALID_CONVERSATION_DATA = {
    entity: 'conversation/turns',
    record_id: 's1#3',
    timestamp: '2026-06-16T00:00:00.000Z',
    payload: { session_key: 's1', turn_number: 3, role: 'assistant' },
};

function sseBody(...chunks: string[]): ReadableStream<Uint8Array> {
    const enc = new TextEncoder();
    return new ReadableStream<Uint8Array>({
        start(controller) {
            for (const c of chunks) controller.enqueue(enc.encode(c));
            controller.close();
        },
    });
}

const instantSleep = (): Promise<void> => Promise.resolve();
const flush = (): Promise<void> => new Promise((r) => setImmediate(r));

describe('runEventStream — event typing & lifecycle', () => {
    it('delivers a typed conversation.turn_created event', async () => {
        const events: RuntimeStreamEvent[] = [];
        let done: () => void = () => {};
        const wait = new Promise<void>((r) => (done = r));
        const connect = jest
            .fn<Promise<ConnectOutcome>, [string | undefined, AbortSignal]>()
            .mockResolvedValueOnce({
                kind: 'open',
                body: sseBody(`event: conversation.turn_created\ndata: ${JSON.stringify(VALID_CONVERSATION_DATA)}\n\n`),
            })
            .mockResolvedValueOnce({ kind: 'terminal', error: new Error('end') });

        runEventStream({
            connect,
            handlers: { onEvent: (e) => events.push(e), onError: () => done() },
            options: {},
            sleep: instantSleep,
        });
        await wait;

        expect(events).toHaveLength(1);
        const e = events[0]!;
        expect(isConversationTurnCreatedEvent(e)).toBe(true);
        if (isConversationTurnCreatedEvent(e)) {
            expect(e.data.payload.session_key).toBe('s1');
            expect(e.data.payload.turn_number).toBe(3);
        }
    });

    it('passes an unknown named event through the generic arm', async () => {
        const events: RuntimeStreamEvent[] = [];
        let done: () => void = () => {};
        const wait = new Promise<void>((r) => (done = r));
        const connect = jest
            .fn<Promise<ConnectOutcome>, [string | undefined, AbortSignal]>()
            .mockResolvedValueOnce({ kind: 'open', body: sseBody('event: record.updated\ndata: {"x":1}\n\n') })
            .mockResolvedValueOnce({ kind: 'terminal', error: new Error('end') });
        runEventStream({ connect, handlers: { onEvent: (e) => events.push(e), onError: () => done() }, options: {}, sleep: instantSleep });
        await wait;
        expect(events).toEqual([{ event: 'record.updated', data: { x: 1 } }]);
        expect(isConversationTurnCreatedEvent(events[0]!)).toBe(false);
    });

    it('drops a malformed-JSON frame and a schema-failing conversation frame (no onEvent, no throw)', async () => {
        const onEvent = jest.fn();
        let done: () => void = () => {};
        const wait = new Promise<void>((r) => (done = r));
        const connect = jest
            .fn<Promise<ConnectOutcome>, [string | undefined, AbortSignal]>()
            .mockResolvedValueOnce({
                kind: 'open',
                // (1) malformed JSON; (2) conversation event missing payload.session_key
                body: sseBody(
                    'event: record.x\ndata: {not json}\n\n' +
                        'event: conversation.turn_created\ndata: {"entity":"conversation/turns","record_id":"r","timestamp":"t","payload":{"turn_number":1}}\n\n',
                ),
            })
            .mockResolvedValueOnce({ kind: 'terminal', error: new Error('end') });
        runEventStream({ connect, handlers: { onEvent, onError: () => done() }, options: {}, sleep: instantSleep });
        await wait;
        expect(onEvent).not.toHaveBeenCalled();
    });

    it('close() stops emission and is idempotent', async () => {
        const onEvent = jest.fn();
        // A connect that never resolves (simulates an open-but-idle stream).
        const connect = jest.fn<Promise<ConnectOutcome>, [string | undefined, AbortSignal]>(
            () => new Promise<ConnectOutcome>(() => undefined),
        );
        const handle = runEventStream({ connect, handlers: { onEvent }, options: {}, sleep: instantSleep });
        await flush();
        handle.close();
        handle.close(); // idempotent
        await flush();
        expect(onEvent).not.toHaveBeenCalled();
        expect(connect).toHaveBeenCalledTimes(1);
    });

    it('aborting the supplied signal tears down without onError', async () => {
        const onError = jest.fn();
        const ac = new AbortController();
        const connect = jest.fn<Promise<ConnectOutcome>, [string | undefined, AbortSignal]>(
            () => new Promise<ConnectOutcome>(() => undefined),
        );
        runEventStream({ connect, handlers: { onError }, options: { signal: ac.signal }, sleep: instantSleep });
        await flush();
        ac.abort();
        await flush();
        expect(onError).not.toHaveBeenCalled();
    });
});

describe('runEventStream — reconnect & classification', () => {
    it('reconnects on EOF carrying Last-Event-ID, unbounded', async () => {
        const ids: (string | undefined)[] = [];
        let done: () => void = () => {};
        const wait = new Promise<void>((r) => (done = r));
        let calls = 0;
        const connect = jest.fn<Promise<ConnectOutcome>, [string | undefined, AbortSignal]>((lastId) => {
            ids.push(lastId);
            calls += 1;
            if (calls <= 3) {
                return Promise.resolve<ConnectOutcome>({ kind: 'open', body: sseBody(`id: ev${calls}\nevent: x\ndata: ${calls}\n\n`) });
            }
            done();
            return Promise.resolve<ConnectOutcome>({ kind: 'terminal', error: new Error('end') });
        });
        runEventStream({ connect, handlers: { onError: () => undefined }, options: {}, sleep: instantSleep });
        await wait;
        // 1st connect: no lastId; subsequent reconnects carry the last id seen.
        expect(ids[0]).toBeUndefined();
        expect(ids[1]).toBe('ev1');
        expect(ids[2]).toBe('ev2');
        expect(calls).toBeGreaterThanOrEqual(4); // unbounded — 3 EOF reconnects + the terminal
    });

    it('reconnect:false ends after the first disconnect', async () => {
        const connect = jest
            .fn<Promise<ConnectOutcome>, [string | undefined, AbortSignal]>()
            .mockResolvedValue({ kind: 'open', body: sseBody('event: x\ndata: 1\n\n') });
        runEventStream({ connect, handlers: {}, options: { reconnect: false }, sleep: instantSleep });
        await flush();
        await flush();
        expect(connect).toHaveBeenCalledTimes(1);
    });

    it('clamps a server retry to the max-delay cap', async () => {
        const delays: number[] = [];
        let done: () => void = () => {};
        const wait = new Promise<void>((r) => (done = r));
        let calls = 0;
        const connect = jest.fn<Promise<ConnectOutcome>, [string | undefined, AbortSignal]>(() => {
            calls += 1;
            if (calls === 1) return Promise.resolve<ConnectOutcome>({ kind: 'open', body: sseBody('retry: 999999\nevent: x\ndata: 1\n\n') });
            done();
            return Promise.resolve<ConnectOutcome>({ kind: 'terminal', error: new Error('end') });
        });
        runEventStream({
            connect,
            handlers: { onError: () => undefined },
            options: {},
            maxDelayMs: 30_000,
            sleep: (ms) => {
                delays.push(ms);
                return Promise.resolve();
            },
        });
        await wait;
        expect(delays[0]).toBe(30_000); // 999999 clamped to the cap
    });

    it('floors a server retry:0 to the base delay (no tight reconnect loop)', async () => {
        const delays: number[] = [];
        let done: () => void = () => {};
        const wait = new Promise<void>((r) => (done = r));
        let calls = 0;
        const connect = jest.fn<Promise<ConnectOutcome>, [string | undefined, AbortSignal]>(() => {
            calls += 1;
            if (calls === 1) return Promise.resolve<ConnectOutcome>({ kind: 'open', body: sseBody('retry: 0\nevent: x\ndata: 1\n\n') });
            done();
            return Promise.resolve<ConnectOutcome>({ kind: 'terminal', error: new Error('end') });
        });
        runEventStream({
            connect,
            handlers: { onError: () => undefined },
            options: {},
            baseDelayMs: 1_000,
            maxDelayMs: 30_000,
            sleep: (ms) => {
                delays.push(ms);
                return Promise.resolve();
            },
        });
        await wait;
        expect(delays[0]).toBe(1_000); // retry:0 floored to base
    });

    it('terminal (onError, no reconnect) vs transient (silent reconnect)', async () => {
        // Terminal:
        const onErrorT = jest.fn();
        let doneT: () => void = () => {};
        const waitT = new Promise<void>((r) => (doneT = r));
        const terminalConnect = jest.fn<Promise<ConnectOutcome>, [string | undefined, AbortSignal]>(() => {
            doneT();
            return Promise.resolve<ConnectOutcome>({ kind: 'terminal', error: new Error('403') });
        });
        runEventStream({ connect: terminalConnect, handlers: { onError: (e) => onErrorT(e) }, options: {}, sleep: instantSleep });
        await waitT;
        expect(onErrorT).toHaveBeenCalledTimes(1);
        expect(terminalConnect).toHaveBeenCalledTimes(1);

        // Transient: reconnects silently (no onError) until we stop it.
        const onErrorX = jest.fn();
        let calls = 0;
        let doneX: () => void = () => {};
        const waitX = new Promise<void>((r) => (doneX = r));
        const transientConnect = jest.fn<Promise<ConnectOutcome>, [string | undefined, AbortSignal]>(() => {
            calls += 1;
            if (calls < 3) return Promise.resolve<ConnectOutcome>({ kind: 'transient' });
            doneX();
            return Promise.resolve<ConnectOutcome>({ kind: 'terminal', error: new Error('end') });
        });
        runEventStream({ connect: transientConnect, handlers: { onError: () => { onErrorX(); doneX(); } }, options: {}, sleep: instantSleep });
        await waitX;
        // onError fires once at the final terminal, never on the transient retries.
        expect(calls).toBe(3);
    });
});

describe('FetchClient.openEventStream — transport, auth, classification', () => {
    function makeFetch(response: Record<string, unknown>): jest.Mock {
        return jest.fn().mockResolvedValue(response as unknown as Response);
    }
    function okStream(...chunks: string[]): Record<string, unknown> {
        return { ok: true, status: 200, body: sseBody(...chunks), headers: new Headers() };
    }
    function errStatus(status: number): Record<string, unknown> {
        return {
            ok: false,
            status,
            body: null,
            headers: new Headers(),
            json: () => Promise.resolve({ error: { type: 'x', code: 'Y', message: 'msg' } }),
        };
    }

    it('GETs /runtime/events/stream with Accept + Bearer (direct mode), no credentials', async () => {
        const fetchFn = makeFetch(okStream('event: x\ndata: 1\n\n'));
        const client = new FetchClient({ baseUrl: 'https://acme.example.com/v1', token: 'rt', fetch: fetchFn, requireTokenCode: 'runtime_token_missing', operations: {} });
        client.openEventStream('/runtime/events/stream', {}, { reconnect: false });
        await flush();
        await flush();
        const [url, init] = fetchFn.mock.calls[0]!;
        expect(String(url)).toBe('https://acme.example.com/v1/runtime/events/stream');
        expect(init.method).toBe('GET');
        expect(init.headers.Accept).toBe('text/event-stream');
        expect(init.headers.Authorization).toBe('Bearer rt');
        expect(init.credentials).toBeUndefined();
    });

    it('omits Authorization + sends credentials in transport-managed mode', async () => {
        const fetchFn = makeFetch(okStream('event: x\ndata: 1\n\n'));
        const client = new FetchClient({ baseUrl: 'https://acme.example.com/v1', token: '', fetch: fetchFn, transportManaged: true, requireTokenCode: 'runtime_token_missing', operations: {} });
        client.openEventStream('/runtime/events/stream', {}, { reconnect: false });
        await flush();
        await flush();
        const [, init] = fetchFn.mock.calls[0]!;
        expect(init.headers.Authorization).toBeUndefined();
        expect(init.credentials).toBe('include');
    });

    it('seeds Last-Event-ID from options.lastEventId', async () => {
        const fetchFn = makeFetch(okStream('event: x\ndata: 1\n\n'));
        const client = new FetchClient({ baseUrl: 'https://acme.example.com/v1', token: 'rt', fetch: fetchFn, operations: {} });
        client.openEventStream('/runtime/events/stream', {}, { reconnect: false, lastEventId: 'pos-9' });
        await flush();
        await flush();
        const [, init] = fetchFn.mock.calls[0]!;
        expect(init.headers['Last-Event-ID']).toBe('pos-9');
    });

    it('classifies 401 as terminal → ZarelAuthError, no reconnect', async () => {
        const fetchFn = makeFetch(errStatus(401));
        const client = new FetchClient({ baseUrl: 'https://acme.example.com/v1', token: 'rt', fetch: fetchFn, operations: {} });
        const onError = jest.fn();
        let done: () => void = () => {};
        const wait = new Promise<void>((r) => (done = r));
        client.openEventStream('/runtime/events/stream', { onError: (e) => { onError(e); done(); } }, {});
        await wait;
        expect(onError.mock.calls[0]![0]).toBeInstanceOf(ZarelAuthError);
        expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('classifies 403 as terminal → ZarelAPIError, no reconnect', async () => {
        const fetchFn = makeFetch(errStatus(403));
        const client = new FetchClient({ baseUrl: 'https://acme.example.com/v1', token: 'rt', fetch: fetchFn, operations: {} });
        const onError = jest.fn();
        let done: () => void = () => {};
        const wait = new Promise<void>((r) => (done = r));
        client.openEventStream('/runtime/events/stream', { onError: (e) => { onError(e); done(); } }, {});
        await wait;
        expect(onError.mock.calls[0]![0]).toBeInstanceOf(ZarelAPIError);
        expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('classifies 500 as transient (no onError) — ends quietly with reconnect:false', async () => {
        const fetchFn = makeFetch(errStatus(500));
        const client = new FetchClient({ baseUrl: 'https://acme.example.com/v1', token: 'rt', fetch: fetchFn, operations: {} });
        const onError = jest.fn();
        client.openEventStream('/runtime/events/stream', { onError }, { reconnect: false });
        await flush();
        await flush();
        expect(onError).not.toHaveBeenCalled();
        expect(fetchFn).toHaveBeenCalledTimes(1);
    });
});
