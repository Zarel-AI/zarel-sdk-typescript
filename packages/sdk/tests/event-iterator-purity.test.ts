// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// The async-iterable adapter owns NO transport. It must not
// re-implement fetch, auth, SSE parsing, or reconnect; `events.stream` stays the
// single event-transport authority. And neither it nor the event types may pull
// in a schema library / EventSource (zero-runtime-deps).
import { readFileSync } from 'fs';
import { join } from 'path';

const SRC = join(__dirname, '..', 'src');
const ITERATOR = readFileSync(join(SRC, '_internal', 'event-iterator.ts'), 'utf8');
const TYPES = readFileSync(join(SRC, 'types', 'events-stream.ts'), 'utf8');

describe('single event-transport authority', () => {
    it('event-iterator.ts contains no transport primitive', () => {
        for (const banned of ['fetch(', 'resolveAuthHeaders', 'parseSseFrames', 'openEventStream', 'runEventStream']) {
            expect(ITERATOR).not.toContain(banned);
        }
    });

    it('event-iterator.ts imports only event-stream types (no fetch/auth/sse module)', () => {
        const imports = [...ITERATOR.matchAll(/from '([^']+)'/g)].map((m) => m[1]);
        expect(imports).toEqual(['../types/events-stream']);
    });
});

describe('no schema library / EventSource', () => {
    it('neither the adapter nor the event types import zod or eventsource', () => {
        for (const src of [ITERATOR, TYPES]) {
            expect(src).not.toMatch(/from '(zod|eventsource)'/);
            expect(src).not.toContain('new EventSource');
        }
    });
});
