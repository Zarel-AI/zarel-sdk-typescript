// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// `EventsResource.iterate` drives the SAME single transport as
// `stream` (one `openEventStream` call, never a second one), surfaces pushed
// frames as typed events through `for await`, and `break` closes the stream.
import { EventsResource } from '../src/resources/events';
import type { FetchClient } from '../src/_internal/fetch-client';
import type {
    EventStreamHandlers,
    EventStreamHandle,
    RuntimeStreamEvent,
} from '../src/types/events-stream';

interface Harness {
    client: FetchClient;
    push: (event: RuntimeStreamEvent) => void;
    openCount: () => number;
    closeCount: () => number;
    lastPath: () => string | undefined;
}

function harness(): Harness {
    let handlers: EventStreamHandlers | undefined;
    let opens = 0;
    let closes = 0;
    let path: string | undefined;
    const openEventStream = (p: string, h: EventStreamHandlers): EventStreamHandle => {
        opens += 1;
        path = p;
        handlers = h;
        return { close: () => { closes += 1; } };
    };
    // Only `openEventStream` is exercised by iterate(); cast the partial via a
    // structural object the resource only calls that one method on.
    const client = { openEventStream } as unknown as FetchClient;
    return {
        client,
        push: (event): void => handlers?.onEvent?.(event),
        openCount: () => opens,
        closeCount: () => closes,
        lastPath: () => path,
    };
}

const turn: RuntimeStreamEvent = {
    event: 'conversation.turn_created',
    data: {
        entity: 'conversation/turns',
        record_id: 's1#1',
        timestamp: '2026-06-18T00:00:00.000Z',
        payload: { session_key: 's1', turn_number: 1, role: 'assistant' },
    },
};
const flush = (): Promise<void> => new Promise((r) => setImmediate(r));

describe('EventsResource.iterate — wiring', () => {
    it('drives a single stream over /runtime/events/stream and yields typed events', async () => {
        const h = harness();
        const events = new EventsResource(h.client);
        const seen: RuntimeStreamEvent[] = [];
        const consume = (async (): Promise<void> => {
            for await (const e of events.iterate()) {
                seen.push(e);
                break;
            }
        })();
        await flush();
        h.push(turn);
        await consume;
        expect(h.openCount()).toBe(1);      // single transport
        expect(h.lastPath()).toBe('/runtime/events/stream');
        expect(seen).toEqual([turn]);
        expect(h.closeCount()).toBe(1);     // break tore it down
    });
});
