// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
import { type FetchClient, localeQueryOrUndefined } from '../_internal/fetch-client';
import type {
    EventListResponse,
    EventSubscriptionInput,
    EventSubscriptionResponse,
    EventSubscriptionListResponse,
    EventSubscriptionDeactivateResponse,
} from '../types/platform';
import type { LocaleOptions } from '../types/locale';
import type {
    EventStreamHandle,
    EventStreamHandlers,
    EventStreamOptions,
    EventIterateOptions,
    RuntimeStreamEvent,
} from '../types/events-stream';
import { createEventIterator } from '../_internal/event-iterator';

export class EventsResource {
    constructor(private readonly client: FetchClient) {}

    /**
     * Open a typed Server-Sent-Events stream of live tenant events
     * (`GET /runtime/events/stream`). Delivers typed `conversation.turn_created`
     * events (and a generic fallback for other named events) to `handlers.onEvent`;
     * reconnects across transient disconnects. Returns a teardown handle.
     */
    stream(handlers: EventStreamHandlers, options?: EventStreamOptions): EventStreamHandle {
        return this.client.openEventStream('/runtime/events/stream', handlers, options ?? {});
    }

    /**
     * The async-iterable (pull) view over the same stream `stream` consumes via
     * callbacks: `for await (const event of client.runtime.events.iterate())`.
     * A thin bounded-buffer adapter over `stream` — it reuses the same transport
     * (auth, reconnect, SSE parsing) verbatim and adds no transport of its own.
     * Backpressure is bounded drop-oldest (`bufferSize`, reported via `onDropped`);
     * a terminal error throws out of the loop; `break` tears the stream down.
     */
    iterate(options?: EventIterateOptions): AsyncIterableIterator<RuntimeStreamEvent> {
        const { bufferSize, onDropped, ...streamOptions } = options ?? {};
        const config = {
            ...(bufferSize !== undefined ? { bufferSize } : {}),
            ...(onDropped !== undefined ? { onDropped } : {}),
            streamOptions,
        };
        return createEventIterator(
            (handlers, streamOpts) =>
                this.client.openEventStream('/runtime/events/stream', handlers, streamOpts),
            config,
        );
    }

    /**
     * List event deliveries (the runtime log of dispatched webhook events,
     * `GET /runtime/events/delivery`).
     */
    async listDeliveries(options?: LocaleOptions): Promise<EventListResponse> {
        const q = localeQueryOrUndefined(options);
        return q
            ? await this.client.get<EventListResponse>('/runtime/events/delivery', q, { operationId: 'listEventDeliveries' })
            : await this.client.get<EventListResponse>('/runtime/events/delivery', undefined, { operationId: 'listEventDeliveries' });
    }

    /**
     * Create a webhook event subscription.
     */
    async subscribe(
        input: EventSubscriptionInput,
        requestOptions?: { signal?: AbortSignal },
    ): Promise<EventSubscriptionResponse> {
        return await this.client.post<EventSubscriptionResponse>('/runtime/events/subscriptions', input, { operationId: 'createEventSubscription', ...requestOptions });
    }

    /**
     * List all event subscriptions.
     */
    async listSubscriptions(options?: LocaleOptions): Promise<EventSubscriptionListResponse> {
        const q = localeQueryOrUndefined(options);
        return q
            ? await this.client.get<EventSubscriptionListResponse>('/runtime/events/subscriptions', q, { operationId: 'listEventSubscriptions' })
            : await this.client.get<EventSubscriptionListResponse>('/runtime/events/subscriptions', undefined, { operationId: 'listEventSubscriptions' });
    }

    /**
     * Deactivate a webhook subscription.
     */
    async deleteSubscription(subscriptionId: string | number): Promise<EventSubscriptionDeactivateResponse> {
        return await this.client.del<EventSubscriptionDeactivateResponse>(`/runtime/events/subscriptions/${subscriptionId}`, { operationId: 'deactivateEventSubscription' });
    }
}
