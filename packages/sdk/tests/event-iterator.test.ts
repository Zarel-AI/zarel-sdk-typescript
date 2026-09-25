// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// The bounded push→pull adapter behind `events.iterate`.
// Drives `createEventIterator` over a FAKE `open` so the test controls the push
// side (onEvent/onError) and observes teardown — no real transport involved.
import { createEventIterator, type OpenStream } from '../src/_internal/event-iterator';
import type {
    EventStreamHandle,
    EventStreamHandlers,
    EventStreamOptions,
    RuntimeStreamEvent,
} from '../src/types/events-stream';

interface FakeStream {
    open: OpenStream;
    push: (event: RuntimeStreamEvent) => void;
    fail: (error: unknown) => void;
    closeCount: () => number;
    lastOptions: () => EventStreamOptions | undefined;
}

function fakeStream(): FakeStream {
    let handlers: EventStreamHandlers | undefined;
    let closes = 0;
    let opts: EventStreamOptions | undefined;
    return {
        open: (h, o): EventStreamHandle => {
            handlers = h;
            opts = o;
            return { close: () => { closes += 1; } };
        },
        push: (event): void => handlers?.onEvent?.(event),
        fail: (error) => handlers?.onError?.(error),
        closeCount: () => closes,
        lastOptions: () => opts,
    };
}

const ev = (n: number): RuntimeStreamEvent => ({ event: 'record.updated', data: { n } });
const flush = (): Promise<void> => new Promise((r) => setImmediate(r));

describe('createEventIterator — FIFO delivery', () => {
    it('drains buffered events in arrival order', async () => {
        const fs = fakeStream();
        const it = createEventIterator(fs.open, { streamOptions: {} });
        // Start the stream by issuing a pending next, then push three events.
        const p1 = it.next();
        fs.push(ev(1));
        fs.push(ev(2));
        fs.push(ev(3));
        expect((await p1).value).toEqual(ev(1));
        expect((await it.next()).value).toEqual(ev(2));
        expect((await it.next()).value).toEqual(ev(3));
    });

    it('works as a for-await source', async () => {
        const fs = fakeStream();
        const it = createEventIterator(fs.open, { streamOptions: {} });
        const seen: RuntimeStreamEvent[] = [];
        const consume = (async (): Promise<void> => {
            for await (const e of it) {
                seen.push(e);
                if (seen.length === 2) break;
            }
        })();
        await flush();
        fs.push(ev(1));
        fs.push(ev(2));
        await consume;
        expect(seen).toEqual([ev(1), ev(2)]);
        expect(fs.closeCount()).toBe(1); // break tore the stream down
    });
});

describe('createEventIterator — empty-buffer wait', () => {
    it('next() stays pending until an event is pushed', async () => {
        const fs = fakeStream();
        const it = createEventIterator(fs.open, { streamOptions: {} });
        let resolved = false;
        const p = it.next().then((r) => { resolved = true; return r; });
        await flush();
        expect(resolved).toBe(false);
        fs.push(ev(7));
        expect((await p).value).toEqual(ev(7));
    });
});

describe('createEventIterator — bounded backpressure', () => {
    it('drops the oldest on overflow, keeps newest, reports running total', async () => {
        const fs = fakeStream();
        const dropped: number[] = [];
        const it = createEventIterator(fs.open, {
            bufferSize: 2,
            onDropped: (n) => dropped.push(n),
            streamOptions: {},
        });
        // Start the stream (a pending next is consumed by the first push), then
        // overflow the buffer without pulling.
        const first = it.next();
        fs.push(ev(0)); // satisfies the pending next
        await first;
        fs.push(ev(1));
        fs.push(ev(2));
        fs.push(ev(3)); // overflow → drop ev(1)
        fs.push(ev(4)); // overflow → drop ev(2)
        expect(dropped).toEqual([1, 2]);
        expect((await it.next()).value).toEqual(ev(3));
        expect((await it.next()).value).toEqual(ev(4));
    });

    it('buffer length never exceeds capacity under a flood', () => {
        const fs = fakeStream();
        let maxDropped = 0;
        const it = createEventIterator(fs.open, {
            bufferSize: 8,
            onDropped: (n) => { maxDropped = n; },
            streamOptions: {},
        });
        void it.next(); // start
        for (let i = 0; i < 1000; i += 1) fs.push(ev(i));
        // 1 went to the pending next; 8 retained; the rest dropped.
        expect(maxDropped).toBe(1000 - 1 - 8);
    });

    it('falls back to the default for a non-finite bufferSize (NaN/Infinity)', () => {
        for (const bad of [Number.NaN, Number.POSITIVE_INFINITY]) {
            const fs = fakeStream();
            let maxDropped = 0;
            const it = createEventIterator(fs.open, {
                bufferSize: bad,
                onDropped: (n) => { maxDropped = n; },
                streamOptions: {},
            });
            void it.next(); // start
            // Push well past the 1024 default but the guard must still fire
            // (a NaN/Infinity capacity would never drop → unbounded).
            for (let i = 0; i < 1100; i += 1) fs.push(ev(i));
            expect(maxDropped).toBe(1100 - 1 - 1024);
        }
    });

    it('clamps bufferSize < 1 to 1', async () => {
        const fs = fakeStream();
        const dropped: number[] = [];
        const it = createEventIterator(fs.open, {
            bufferSize: 0,
            onDropped: (n) => dropped.push(n),
            streamOptions: {},
        });
        const first = it.next();
        fs.push(ev(0));
        await first;
        fs.push(ev(1));
        fs.push(ev(2)); // capacity 1 → drop ev(1)
        expect(dropped).toEqual([1]);
        expect((await it.next()).value).toEqual(ev(2));
    });
});

describe('createEventIterator — terminal error', () => {
    it('throws out of next() when the buffer is empty', async () => {
        const fs = fakeStream();
        const it = createEventIterator(fs.open, { streamOptions: {} });
        const p = it.next();
        fs.fail(new Error('boom'));
        await expect(p).rejects.toThrow('boom');
        expect(fs.closeCount()).toBe(1);
    });

    it('drains buffered events BEFORE surfacing the error (data-before-error)', async () => {
        const fs = fakeStream();
        const it = createEventIterator(fs.open, { streamOptions: {} });
        const p0 = it.next();   // start the stream (becomes the waiter)
        fs.push(ev(1));         // resolves p0
        await p0;
        fs.push(ev(2));         // buffered (no waiter)
        fs.push(ev(3));         // buffered
        fs.fail(new Error('later')); // terminal recorded; buffer non-empty → deferred
        expect((await it.next()).value).toEqual(ev(2)); // drains first
        expect((await it.next()).value).toEqual(ev(3)); // drains second
        await expect(it.next()).rejects.toThrow('later'); // THEN the error
        expect(fs.closeCount()).toBe(1);
    });
});

describe('createEventIterator — teardown', () => {
    it('return() closes the underlying stream once (idempotent)', async () => {
        const fs = fakeStream();
        const it = createEventIterator(fs.open, { streamOptions: {} });
        void it.next(); // start
        await it.return!();
        await it.return!();
        expect(fs.closeCount()).toBe(1);
        expect((await it.next())).toEqual({ value: undefined, done: true });
    });

    it('throw() tears down and rethrows', async () => {
        const fs = fakeStream();
        const it = createEventIterator(fs.open, { streamOptions: {} });
        void it.next(); // start
        await expect(it.throw!(new Error('stop'))).rejects.toThrow('stop');
        expect(fs.closeCount()).toBe(1);
    });

    it('rejects a concurrent second next() rather than orphaning the first', async () => {
        const fs = fakeStream();
        const it = createEventIterator(fs.open, { streamOptions: {} });
        const p1 = it.next(); // parks as the single waiter
        await flush();
        await expect(it.next()).rejects.toThrow('concurrent next() is not supported');
        fs.push(ev(1)); // the first waiter still resolves normally
        expect((await p1).value).toEqual(ev(1));
    });

    it('does not resurface a recorded terminal error after an abort (abort wins)', async () => {
        const fs = fakeStream();
        const ac = new AbortController();
        const it = createEventIterator(fs.open, { streamOptions: { signal: ac.signal } });
        const p0 = it.next();
        fs.push(ev(1)); // resolves p0
        await p0;
        fs.push(ev(2));              // buffered
        fs.fail(new Error('boom')); // recorded, deferred (buffer non-empty)
        ac.abort();                 // teardown wins → clears the recorded error
        // Draining continues to a clean end; the error never throws.
        for (;;) {
            const r = await it.next();
            if (r.done) break;
        }
        expect(fs.closeCount()).toBe(1);
    });

    it('an already-aborted signal ends immediately without leaving next() pending', async () => {
        const fs = fakeStream();
        const ac = new AbortController();
        ac.abort();
        const it = createEventIterator(fs.open, { streamOptions: { signal: ac.signal } });
        expect(await it.next()).toEqual({ value: undefined, done: true });
    });

    it('aborting mid-iteration ends a pending next()', async () => {
        const fs = fakeStream();
        const ac = new AbortController();
        const it = createEventIterator(fs.open, { streamOptions: { signal: ac.signal } });
        const p = it.next();
        await flush();
        ac.abort();
        expect(await p).toEqual({ value: undefined, done: true });
    });
});

describe('createEventIterator — option forwarding', () => {
    it('forwards stream options (reconnect/lastEventId) to the underlying open', () => {
        const fs = fakeStream();
        const it = createEventIterator(fs.open, {
            streamOptions: { reconnect: false, lastEventId: 'abc' },
        });
        void it.next(); // triggers open
        expect(fs.lastOptions()).toEqual({ reconnect: false, lastEventId: 'abc' });
    });
});
