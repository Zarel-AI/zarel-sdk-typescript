// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// SSE stream client internals: a pure SSE frame parser + a transport-agnostic
// reconnect loop. The actual `fetch` + auth live in a thin `FetchClient.openEventStream`
// method (so they reuse the client's own fetchFn/baseUrl/auth — no private-field leak);
// that method injects a `connect` closure here. Built on native WHATWG streams +
// `TextDecoder` — ZERO runtime dependencies.

import type {
    EventStreamHandle,
    EventStreamHandlers,
    EventStreamOptions,
} from '../types/events-stream';
import { toRuntimeStreamEvent } from '../types/events-stream';

// Default reconnect backoff window (ms): exponential from 1 s, capped at 30 s.
const SSE_BASE_DELAY_MS = 1_000;
const SSE_MAX_DELAY_MS = 30_000;

// ── Pure frame parser ─────────────────────────────────────────────────────

export interface RawSseFrame {
    event?: string;
    data: string;
    id?: string;
    retry?: number;
}

function parseBlock(block: string): RawSseFrame | null {
    let event: string | undefined;
    let id: string | undefined;
    let retry: number | undefined;
    const dataLines: string[] = [];
    let hasField = false;

    for (let line of block.split('\n')) {
        if (line.endsWith('\r')) line = line.slice(0, -1);
        // A comment line (leading ':' — e.g. ':heartbeat', ':ok') carries no field.
        if (line === '' || line.startsWith(':')) continue;
        const colon = line.indexOf(':');
        const field = colon === -1 ? line : line.slice(0, colon);
        let value = colon === -1 ? '' : line.slice(colon + 1);
        if (value.startsWith(' ')) value = value.slice(1);
        switch (field) {
        case 'event':
            event = value;
            hasField = true;
            break;
        case 'data':
            dataLines.push(value);
            hasField = true;
            break;
        case 'id':
            // Per the SSE spec, an id containing a NUL is ignored.
            if (!value.includes(String.fromCharCode(0))) {
                id = value;
                hasField = true;
            }
            break;
        case 'retry':
            if (/^\d+$/.test(value)) {
                retry = Number(value);
                hasField = true;
            }
            break;
        default:
            break;
        }
    }

    if (!hasField) return null;
    const frame: RawSseFrame = { data: dataLines.join('\n') };
    if (event !== undefined) frame.event = event;
    if (id !== undefined) frame.id = id;
    if (retry !== undefined) frame.retry = retry;
    return frame;
}

/**
 * Incrementally parse SSE text. Pure over `(chunk, carry)`: returns the complete
 * frames found and the leftover `carry` (an unterminated trailing block) to feed
 * into the next call. Frames are delimited by a blank line (`\n\n`).
 */
export function parseSseFrames(chunk: string, carry: string): { frames: RawSseFrame[]; carry: string } {
    // Normalize CRLF → LF so the `\n\n` boundary scan is line-ending-agnostic. A
    // lone trailing `\r` (a CRLF split across chunks) stays in `carry` until its
    // `\n` arrives next call, so the pair still normalizes correctly.
    const buffer = (carry + chunk).replace(/\r\n/g, '\n');
    const frames: RawSseFrame[] = [];
    let start = 0;
    let sep: number;
    while ((sep = buffer.indexOf('\n\n', start)) !== -1) {
        const frame = parseBlock(buffer.slice(start, sep));
        if (frame) frames.push(frame);
        start = sep + 2;
    }
    return { frames, carry: buffer.slice(start) };
}

// ── Reconnect loop ─────────────────────────────────────────────────────────

/** The outcome of one connect attempt, classified by the transport. */
export type ConnectOutcome =
    | { kind: 'open'; body: ReadableStream<Uint8Array> }
    | { kind: 'terminal'; error: unknown }
    | { kind: 'transient'; error?: unknown };

export interface StreamLoopDeps {
    /** One connect attempt. Resolves an open body, or a terminal/transient disposition. */
    connect: (lastEventId: string | undefined, signal: AbortSignal) => Promise<ConnectOutcome>;
    handlers: EventStreamHandlers;
    options: EventStreamOptions;
    // Injectable for deterministic tests; default to the module constants / real timers.
    baseDelayMs?: number;
    maxDelayMs?: number;
    sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
}

function defaultSleep(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
        if (signal.aborted) {
            resolve();
            return;
        }
        const timer = setTimeout(() => {
            signal.removeEventListener('abort', onAbort);
            resolve();
        }, ms);
        const onAbort = (): void => {
            clearTimeout(timer);
            resolve();
        };
        signal.addEventListener('abort', onAbort, { once: true });
    });
}

/**
 * Drive a self-reconnecting SSE consumption loop. Returns an `EventStreamHandle`
 * synchronously; the first connect happens asynchronously. Reconnect attempts are
 * UNBOUNDED (until `close()`/abort/terminal); only the per-attempt delay is capped.
 */
export function runEventStream(deps: StreamLoopDeps): EventStreamHandle {
    const { connect, handlers, options } = deps;
    const baseDelayMs = deps.baseDelayMs ?? SSE_BASE_DELAY_MS;
    const maxDelayMs = deps.maxDelayMs ?? SSE_MAX_DELAY_MS;
    const sleep = deps.sleep ?? defaultSleep;
    const reconnectEnabled = options.reconnect !== false;

    const controller = new AbortController();
    let closed = false;
    let lastEventId = options.lastEventId;

    const close = (): void => {
        if (closed) return;
        closed = true;
        controller.abort();
    };

    // Aborting the caller signal is equivalent to close().
    if (options.signal) {
        if (options.signal.aborted) {
            closed = true;
        } else {
            options.signal.addEventListener('abort', close, { once: true });
        }
    }

    const emitFrame = (frame: RawSseFrame): void => {
        if (frame.id !== undefined) lastEventId = frame.id;
        // A frame with no event name and no data (e.g. an id-only or retry-only
        // frame) carries no event to surface.
        if (frame.event === undefined && frame.data === '') return;
        let parsed: unknown;
        try {
            parsed = frame.data === '' ? undefined : JSON.parse(frame.data);
        } catch {
            // Malformed JSON — drop the frame (loss-tolerant), never throw.
            return;
        }
        const mapped = toRuntimeStreamEvent(frame.event ?? 'message', parsed, frame.id);
        // `undefined` ⇒ a known-event validation failure ⇒ drop.
        if (mapped !== undefined) handlers.onEvent?.(mapped);
    };

    const computeDelay = (attempt: number, serverRetry: number | undefined): number => {
        // A server-supplied `retry:` is clamped to [baseDelayMs, maxDelayMs]: the
        // upper cap stops a hostile server pinning a huge delay; the lower floor
        // stops a `retry: 0` (or tiny) value from spinning a tight reconnect loop.
        if (serverRetry !== undefined) {
            return Math.min(Math.max(serverRetry, baseDelayMs), maxDelayMs);
        }
        const backoff = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
        const jitter = Math.random() * backoff * 0.1;
        return Math.min(backoff + jitter, maxDelayMs);
    };

    const run = async (): Promise<void> => {
        let attempt = 0;
        while (!closed) {
            let outcome: ConnectOutcome;
            try {
                outcome = await connect(lastEventId, controller.signal);
            } catch (error) {
                // A thrown connect (e.g. a missing-token ZarelAuthError) is terminal.
                if (!closed) handlers.onError?.(error);
                return;
            }
            if (closed) return;

            if (outcome.kind === 'terminal') {
                handlers.onError?.(outcome.error);
                return;
            }

            let serverRetry: number | undefined;
            if (outcome.kind === 'open') {
                handlers.onOpen?.();
                serverRetry = await readSseBody(outcome.body, controller.signal, (frame) => {
                    // Reset backoff once this connection yields a frame.
                    attempt = 0;
                    emitFrame(frame);
                });
                if (closed) return;
                // Body ended (server EOF / read error) → transient.
            }
            // transient (or open-then-EOF): reconnect unless disabled.
            if (!reconnectEnabled) return;
            const delay = computeDelay(attempt, serverRetry);
            attempt += 1;
            await sleep(delay, controller.signal);
            if (closed) return;
        }
    };

    void run();
    return { close };
}

/**
 * Read an open SSE body to completion, invoking `onFrame` per parsed frame.
 * Returns the last server-suggested `retry` value seen (for backoff seeding).
 * A read error / abort ends the read (the loop treats it as transient).
 */
async function readSseBody(
    body: ReadableStream<Uint8Array>,
    signal: AbortSignal,
    onFrame: (frame: RawSseFrame) => void,
): Promise<number | undefined> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let carry = '';
    let serverRetry: number | undefined;
    try {
        for (;;) {
            const { done, value } = await reader.read();
            if (done || signal.aborted) break;
            const text = decoder.decode(value, { stream: true });
            const { frames, carry: nextCarry } = parseSseFrames(text, carry);
            carry = nextCarry;
            for (const frame of frames) {
                if (frame.retry !== undefined) serverRetry = frame.retry;
                onFrame(frame);
            }
        }
    } catch {
        // Read error / abort → end the read; the loop treats it as transient
        // (or, if closed, exits without reconnect). No rethrow.
    } finally {
        try {
            await reader.cancel();
        } catch {
            // best-effort
        }
    }
    return serverRetry;
}
