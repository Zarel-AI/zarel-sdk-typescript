// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
import { type FetchClient, localeQueryOrUndefined } from '../_internal/fetch-client';
import type {
    FlowCallbackListResponse,
    FlowCallbackResolution,
    FlowCallbackResponse,
    FlowEventListResponse,
    FlowEventResponse,
    FlowInstanceListResponse,
    FlowInstanceResponse,
} from '../types/flows';
import type { LocaleOptions } from '../types/locale';

/**
 * Runtime flow instances, events, and callbacks.
 *
 * Backs the `/runtime/flows/*` route family. Method names follow the
 * canonical operationIds from the OpenAPI spec (`listFlowInstances`,
 * `getFlowInstance`, `resolveFlowCallback`).
 */
export class FlowsResource {
    constructor(private readonly client: FetchClient) {}

    async listInstances(options?: LocaleOptions & { flow?: string }): Promise<FlowInstanceListResponse> {
        // Optional `flow` filter (`?flow={name}`) narrows the list to one
        // flow's runs; it combines with the locale query.
        const q: Record<string, string> = {};
        if (options?.locale) q.locale = options.locale;
        if (options?.flow) q.flow = options.flow;
        return Object.keys(q).length > 0
            ? await this.client.get<FlowInstanceListResponse>('/runtime/flows/instances', q, { operationId: 'listFlowInstances' })
            : await this.client.get<FlowInstanceListResponse>('/runtime/flows/instances', undefined, { operationId: 'listFlowInstances' });
    }

    async getInstance(instanceId: string, options?: LocaleOptions): Promise<FlowInstanceResponse> {
        const path = `/runtime/flows/instances/${encodeURIComponent(instanceId)}`;
        const q = localeQueryOrUndefined(options);
        return q
            ? await this.client.get<FlowInstanceResponse>(path, q, { operationId: 'getFlowInstance' })
            : await this.client.get<FlowInstanceResponse>(path, undefined, { operationId: 'getFlowInstance' });
    }

    /**
     * The appended flow lifecycle log — where per-step history lives
     * (`GET /runtime/flows/events`). A flow instance carries no per-step data;
     * read it here.
     *
     * Pass `instanceId` for one run's trace. Events come back in CHAIN order
     * (`seq`), not `created_at` — events appended together can share a
     * timestamp, so only `seq` is a total order.
     */
    async listEvents(options?: LocaleOptions & { instanceId?: string; eventType?: string }): Promise<FlowEventListResponse> {
        const q: Record<string, string> = {};
        if (options?.locale) q.locale = options.locale;
        if (options?.instanceId) q.instance_id = options.instanceId;
        if (options?.eventType) q.event_type = options.eventType;
        return Object.keys(q).length > 0
            ? await this.client.get<FlowEventListResponse>('/runtime/flows/events', q, { operationId: 'listFlowEvents' })
            : await this.client.get<FlowEventListResponse>('/runtime/flows/events', undefined, { operationId: 'listFlowEvents' });
    }

    async getEvent(eventId: string, options?: LocaleOptions): Promise<FlowEventResponse> {
        const path = `/runtime/flows/events/${encodeURIComponent(eventId)}`;
        const q = localeQueryOrUndefined(options);
        return q
            ? await this.client.get<FlowEventResponse>(path, q, { operationId: 'getFlowEvent' })
            : await this.client.get<FlowEventResponse>(path, undefined, { operationId: 'getFlowEvent' });
    }

    /** The tenant's flow callbacks — a suspended run's resumption points. */
    async listCallbacks(options?: LocaleOptions): Promise<FlowCallbackListResponse> {
        const q = localeQueryOrUndefined(options);
        return q
            ? await this.client.get<FlowCallbackListResponse>('/runtime/flows/callbacks', q, { operationId: 'listFlowCallbacks' })
            : await this.client.get<FlowCallbackListResponse>('/runtime/flows/callbacks', undefined, { operationId: 'listFlowCallbacks' });
    }

    /** One flow callback. */
    async getCallback(callbackId: string, options?: LocaleOptions): Promise<FlowCallbackResponse> {
        const path = `/runtime/flows/callbacks/${encodeURIComponent(callbackId)}`;
        const q = localeQueryOrUndefined(options);
        return q
            ? await this.client.get<FlowCallbackResponse>(path, q, { operationId: 'getFlowCallback' })
            : await this.client.get<FlowCallbackResponse>(path, undefined, { operationId: 'getFlowCallback' });
    }

    /**
     * Resolve a pending flow callback with `{action: 'complete', payload}` or
     * `{action: 'fail', reason?}`. Answers the resolved callback.
     *
     * REQUIRES A TOKEN: a token-less PATCH is refused `401`, so an external worker
     * resolving a callback must authenticate like any other caller.
     *
     * The response is the canonical envelope carrying the resolved `FlowCallback`;
     * the transport unwraps it, so this returns the `FlowCallback` itself.
     */
    async resolveCallback(callbackId: string, resolution: FlowCallbackResolution): Promise<FlowCallbackResponse> {
        return await this.client.patch<FlowCallbackResponse>(
            `/runtime/flows/callbacks/${encodeURIComponent(callbackId)}`,
            resolution,
            { operationId: 'resolveFlowCallback' },
        );
    }
}
