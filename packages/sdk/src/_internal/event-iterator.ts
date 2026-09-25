// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// Async-iterable (pull) view over the callback-based event stream. A thin,
// transport-agnostic adapter: it converts the push API (`onEvent`/`onError`)
// into an `AsyncIterableIterator` backed by a bounded FIFO buffer. It owns NO
// transport concern — no fetch, no auth, no SSE parsing, no reconnect; it drives
// an injected `open(handlers) => EventStreamHandle` (in production, that is
// `events.stream`). This keeps `events.stream` the single event-transport
// authority and the SDK dependency-free.

import type {
    EventStreamHandle,
    EventStreamHandlers,
    EventStreamOptions,
    RuntimeStreamEvent,
} from '../types/events-stream';

const DEFAULT_BUFFER_SIZE = 1024;

/** Opens an underlying stream with the given handlers; returns its teardown handle. */
export type OpenStream = (handlers: EventStreamHandlers, options: EventStreamOptions) => EventStreamHandle;

export interface EventIteratorConfig {
    /** Bounded buffer capacity; clamped to a minimum of 1. */
    bufferSize?: number;
    /** Reported with the running total on each overflow drop. */
    onDropped?: (totalDropped: number) => void;
    /** Stream options forwarded verbatim to `open` (signal/reconnect/lastEventId). */
    streamOptions: EventStreamOptions;
}

type PendingResult = IteratorResult<RuntimeStreamEvent, undefined>;
// What an empty-buffer waiter is settled with: a normal result, or a terminal
// error to re-throw. We never reject the waiter's promise directly — the `next`
// async function throws the carried error, so the original (arbitrary) error
// type reaches the consumer unchanged.
type Settlement = { result: PendingResult } | { error: unknown };

/**
 * Build an `AsyncIterableIterator<RuntimeStreamEvent>` over `open`. The first
 * `next()` (or entry into a `for await`) lazily opens the stream; `return()` /
 * `throw()` / consumer `break` tear it down via the handle's idempotent `close()`.
 */
export function createEventIterator(
    open: OpenStream,
    config: EventIteratorConfig,
): AsyncIterableIterator<RuntimeStreamEvent> {
    // A non-finite `bufferSize` (NaN/Infinity) would make the `>= capacity`
    // overflow guard never fire — defeating the bound the buffer exists to
    // enforce — so fall back to the default for anything not a finite number.
    const requested = config.bufferSize;
    const capacity = typeof requested === 'number' && Number.isFinite(requested)
        ? Math.max(1, Math.floor(requested))
        : DEFAULT_BUFFER_SIZE;
    const buffer: RuntimeStreamEvent[] = [];

    let handle: EventStreamHandle | undefined;
    let started = false;
    let done = false;
    let dropped = 0;
    let terminalError: { error: unknown } | undefined;
    // The single waiter for an empty-buffer `next()`. Single-consumer by design.
    let pending: { settle: (s: Settlement) => void } | undefined;

    const teardown = (): void => {
        if (done) return;
        done = true;
        handle?.close();
    };

    const push = (event: RuntimeStreamEvent): void => {
        if (done) return;
        if (pending) {
            // A consumer is waiting on an empty buffer — hand the event straight over.
            const waiter = pending;
            pending = undefined;
            waiter.settle({ result: { value: event, done: false } });
            return;
        }
        if (buffer.length >= capacity) {
            // Drop the OLDEST queued event (loss-tolerant), keep the newest.
            buffer.shift();
            dropped += 1;
            config.onDropped?.(dropped);
        }
        buffer.push(event);
    };

    const fail = (error: unknown): void => {
        if (done || terminalError) return;
        terminalError = { error };
        // Surface immediately only if a consumer is parked on an empty buffer;
        // otherwise buffered events drain first and the error surfaces on the
        // `next()` that finds the buffer empty (data-before-error).
        if (pending && buffer.length === 0) {
            const waiter = pending;
            pending = undefined;
            done = true;
            handle?.close();
            waiter.settle({ error });
        }
    };

    const ensureStarted = (): void => {
        if (started) return;
        started = true;
        handle = open({ onEvent: push, onError: fail }, config.streamOptions);
    };

    const next = async (): Promise<PendingResult> => {
        const buffered = buffer.shift();
        if (buffered !== undefined) {
            return { value: buffered, done: false };
        }
        if (terminalError) {
            const { error } = terminalError;
            // Surface the terminal error exactly once; a later pull ends cleanly.
            terminalError = undefined;
            teardown();
            throw error;
        }
        if (done) {
            return { value: undefined, done: true };
        }
        ensureStarted();
        // The stream may already be torn down (e.g. an already-aborted signal):
        // surface a clean end rather than parking forever.
        if (config.streamOptions.signal?.aborted) {
            teardown();
            return { value: undefined, done: true };
        }
        if (pending) {
            // Single-consumer by design: a second concurrent pull would orphan
            // the first waiter. Fail loudly rather than hang silently.
            throw new Error(
                'events.iterate(): concurrent next() is not supported — consume the iterator sequentially (a single for-await loop).',
            );
        }
        const settlement = await new Promise<Settlement>((resolve) => {
            pending = { settle: resolve };
        });
        if ('error' in settlement) throw settlement.error;
        return settlement.result;
    };

    const settleDone = (): PendingResult => {
        teardown();
        // A consumer-driven end (break/return/throw) or abort wins over a
        // previously-recorded stream error — it must not resurface afterwards.
        terminalError = undefined;
        if (pending) {
            const waiter = pending;
            pending = undefined;
            waiter.settle({ result: { value: undefined, done: true } });
        }
        return { value: undefined, done: true };
    };

    const iterator: AsyncIterableIterator<RuntimeStreamEvent> = {
        next,
        return(): Promise<PendingResult> {
            return Promise.resolve(settleDone());
        },
        throw(error?: unknown): Promise<PendingResult> {
            settleDone();
            // Re-raise the exact value the caller passed (the async-iterator
            // protocol), via a throwing continuation rather than
            // `Promise.reject` so the original (arbitrary) value is preserved.
            return Promise.resolve().then<PendingResult>(() => {
                throw error;
            });
        },
        [Symbol.asyncIterator](): AsyncIterableIterator<RuntimeStreamEvent> {
            return iterator;
        },
    };

    // An already-aborted caller signal means "never start" — the first `next()`
    // resolves done. A signal aborted mid-iteration is teardown via the
    // underlying stream (it maps abort → close), which ends the buffer drain.
    const signal = config.streamOptions.signal;
    if (signal && !signal.aborted) {
        signal.addEventListener('abort', () => settleDone(), { once: true });
    }

    return iterator;
}
