// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// Typed runtime SSE event map for `client.runtime.events.stream`.
//
// The runtime event stream (`GET /runtime/events/stream`) emits NAMED
// SSE frames. `conversation.turn_created` carries a fixed metadata-only envelope; all
// other named events (record mutations, state transitions, …) pass through as
// the generic arm with `data: unknown`.
//
// Boundary validation uses a HAND-WRITTEN runtime type-guard — NOT Zod: the SDK
// ships ZERO runtime dependencies, so it follows the hand-written envelope-shape
// guard precedent in `fetch-client.ts`. A frame whose JSON is malformed or whose shape
// fails the guard is dropped (never thrown into `onEvent`) — the leg is
// loss-tolerant.

import type { SseConversationTurnCreatedData, SseConversationTurnCreatedPayload } from '../generated';

// `conversation.turn_created`'s payload/envelope types are CODEGEN-DERIVED from the
// OpenAPI (`components.schemas.RuntimeSseConversationTurnCreated*`, regenerated from it
// and held byte-identical to a fresh generation) — the OpenAPI is the
// single source of truth for the shape. The runtime validation below
// stays HAND-WRITTEN (codegen = types; guards = boundary validation; zero-dep).

/** Metadata-only payload of a `conversation.turn_created` event. */
export type ConversationTurnCreatedPayload = SseConversationTurnCreatedPayload;

/** The SSE bridge wraps every event's data as `{entity, record_id, payload, timestamp}`. */
export type ConversationTurnCreatedData = SseConversationTurnCreatedData;

/** A typed `conversation.turn_created` event. `id` is the SSE frame id (correlation / Last-Event-ID anchor). */
export interface ConversationTurnCreatedEvent {
    event: 'conversation.turn_created';
    id?: string;
    data: ConversationTurnCreatedData;
}

/** Any other named runtime event — `data` is left unvalidated. */
export interface GenericStreamEvent {
    event: string;
    id?: string;
    data: unknown;
}

/**
 * A typed runtime stream event. Narrow to the `conversation.turn_created` arm with the
 * exported `isConversationTurnCreatedEvent` guard (a plain `event === '…'` check does NOT
 * narrow, because the generic arm's `event: string` overlaps the literal).
 */
export type RuntimeStreamEvent = ConversationTurnCreatedEvent | GenericStreamEvent;

/** Handlers for `events.stream`. Only `onEvent` is typically needed. */
export interface EventStreamHandlers {
    /** Each complete, parsed, typed frame. Heartbeats/comments never surface. */
    onEvent?: (event: RuntimeStreamEvent) => void;
    /** A terminal (non-reconnectable) error — invoked at most once. */
    onError?: (err: unknown) => void;
    /** Fired on each successful (re)connect. */
    onOpen?: () => void;
}

/** Options for `events.stream`. */
export interface EventStreamOptions {
    /** Aborting this is equivalent to `handle.close()`. */
    signal?: AbortSignal;
    /** Reconnect on transient disconnects (default: true). */
    reconnect?: boolean;
    /** Seed `Last-Event-ID` on the initial connect (resume a known position). */
    lastEventId?: string;
}

/** The teardown handle returned by `events.stream`. */
export interface EventStreamHandle {
    /** Idempotent teardown: abort the request, cancel the reader, stop reconnecting. */
    close(): void;
}

/**
 * Options for `events.iterate` — the async-iterable (pull) view over the same
 * stream `events.stream` consumes via callbacks. Extends `EventStreamOptions`
 * (`signal`/`reconnect`/`lastEventId` apply identically) with the pull-view's
 * bounded-buffer controls. `onOpen` is intentionally absent: a per-connect
 * signal has no meaning to a `for await` loop (use `events.stream` for that).
 */
export interface EventIterateOptions extends EventStreamOptions {
    /**
     * Capacity of the bounded FIFO buffer between the push producer (SSE frames)
     * and the pull consumer (`for await`). Default 1024. Values below 1 clamp to 1.
     * On overflow the OLDEST queued event is dropped (loss-tolerant, matching the
     * stream leg), keeping memory bounded regardless of consumer speed.
     */
    bufferSize?: number;
    /**
     * Invoked once per overflow drop with the running total of dropped events,
     * so a slow consumer can observe loss out-of-band (the iterator value type
     * stays a clean `RuntimeStreamEvent`).
     */
    onDropped?: (totalDropped: number) => void;
}

const CONVERSATION_TURN_CREATED = 'conversation.turn_created';

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

/**
 * Runtime type-guard for a `conversation.turn_created` event's `data` envelope (the
 * single boundary-validation authority for the typed arm — no `as`).
 */
export function isConversationTurnCreatedData(data: unknown): data is ConversationTurnCreatedData {
    if (!isRecord(data)) return false;
    if (typeof data.entity !== 'string') return false;
    if (typeof data.record_id !== 'string') return false;
    if (typeof data.timestamp !== 'string') return false;
    const payload = data.payload;
    if (!isRecord(payload)) return false;
    if (typeof payload.session_key !== 'string') return false;
    if (typeof payload.turn_number !== 'number') return false;
    if (typeof payload.role !== 'string') return false;
    return true;
}

/** Narrowing guard so consumers get the typed `conversation.turn_created` `data` shape. */
export function isConversationTurnCreatedEvent(event: RuntimeStreamEvent): event is ConversationTurnCreatedEvent {
    return event.event === CONVERSATION_TURN_CREATED;
}

/**
 * Map a raw SSE frame (event name + parsed `data` JSON + optional id) to a typed
 * `RuntimeStreamEvent`. Returns `undefined` when a `conversation.turn_created` frame fails
 * validation (drop, never throw). Other named events pass through as the generic arm.
 */
export function toRuntimeStreamEvent(
    eventName: string,
    data: unknown,
    id: string | undefined,
): RuntimeStreamEvent | undefined {
    if (eventName === CONVERSATION_TURN_CREATED) {
        if (!isConversationTurnCreatedData(data)) return undefined;
        return id !== undefined
            ? { event: CONVERSATION_TURN_CREATED, id, data }
            : { event: CONVERSATION_TURN_CREATED, data };
    }
    return id !== undefined ? { event: eventName, id, data } : { event: eventName, data };
}
