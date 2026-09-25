// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
import { type FetchClient, localeQuery } from '../_internal/fetch-client';
import type {
    StateMachineEventListParams,
    StateMachineEventListResponse,
    StateMachineEventResponse,
    StateMachineInstanceListResponse,
    StateMachineInstanceResponse,
    TransitionRequestCreateBody,
    TransitionRequestListParams,
    TransitionRequestListResponse,
    TransitionRequestResolveInput,
    TransitionRequestPatchResponse,
    TransitionRequestResponse,
} from '../types/state-machine';
import type { LocaleOptions } from '../types/locale';
import type { WorkflowReplayRequest, WorkflowReplayResponse } from '../types/workflows';

/**
 * Canonical state-machine surface for the runtime scope.
 *
 * Backs the `/runtime/state-machine/*` route family:
 *   /runtime/state-machine/instances                    (readonly)
 *   /runtime/state-machine/events                       (readonly)
 *   /runtime/state-machine/transition-requests          (mutable)
 *   /runtime/state-machine/replay                       (service endpoint)
 */
export class StateMachineResource {
    constructor(private readonly client: FetchClient) {}

    // ── Instances (readonly) ────────────────────────────────────────────

    async listInstances(options?: LocaleOptions): Promise<StateMachineInstanceListResponse> {
        return await this.client.get<StateMachineInstanceListResponse>(
            '/runtime/state-machine/instances',
            localeQuery(options),
            { operationId: 'listStateMachineInstances' },
        );
    }

    async getInstance(instanceId: string, options?: LocaleOptions): Promise<StateMachineInstanceResponse> {
        return await this.client.get<StateMachineInstanceResponse>(
            `/runtime/state-machine/instances/${encodeURIComponent(instanceId)}`,
            localeQuery(options),
            { operationId: 'getStateMachineInstance' },
        );
    }

    // ── Events (readonly) ───────────────────────────────────────────────

    async listEvents(
        params?: StateMachineEventListParams,
        options?: LocaleOptions,
    ): Promise<StateMachineEventListResponse> {
        const query: Record<string, string | undefined> = {};
        if (params?.entity_name) query.entity_name = params.entity_name;
        if (params?.instance_id) query.instance_id = params.instance_id;
        if (options?.locale) query.locale = options.locale;
        return await this.client.get<StateMachineEventListResponse>('/runtime/state-machine/events', query, { operationId: 'listStateMachineEvents' });
    }

    async getEvent(eventId: string, options?: LocaleOptions): Promise<StateMachineEventResponse> {
        return await this.client.get<StateMachineEventResponse>(
            `/runtime/state-machine/events/${encodeURIComponent(eventId)}`,
            localeQuery(options),
            { operationId: 'getStateMachineEvent' },
        );
    }

    // ── Transition Requests (mutable) ──────────────────────────────────

    async listTransitionRequests(
        params?: TransitionRequestListParams,
        options?: LocaleOptions,
    ): Promise<TransitionRequestListResponse> {
        const query: Record<string, string | string[] | undefined> = {};
        if (params?.status) query.status = params.status;
        if (params?.roles && params.roles.length > 0) query.roles = params.roles;
        if (options?.locale) query.locale = options.locale;
        return await this.client.get<TransitionRequestListResponse>('/runtime/state-machine/transition-requests', query, { operationId: 'listTransitionRequests' });
    }

    /**
     * Convenience: list transition requests with `status=pending`.
     */
    async listPendingTransitions(
        params?: { roles?: string[] },
        options?: LocaleOptions,
    ): Promise<TransitionRequestListResponse> {
        return await this.listTransitionRequests({
            status: 'pending',
            ...(params?.roles && params.roles.length > 0 ? { roles: params.roles } : {}),
        }, options);
    }

    async getTransitionRequest(transitionRequestId: string, options?: LocaleOptions): Promise<TransitionRequestResponse> {
        return await this.client.get<TransitionRequestResponse>(
            `/runtime/state-machine/transition-requests/${encodeURIComponent(transitionRequestId)}`,
            localeQuery(options),
            { operationId: 'getTransitionRequest' },
        );
    }

    async createTransitionRequest(body: TransitionRequestCreateBody): Promise<TransitionRequestResponse> {
        return await this.client.post<TransitionRequestResponse>('/runtime/state-machine/transition-requests', body, { operationId: 'createTransitionRequest' });
    }

    /**
     * Resolve (approve/reject) a pending transition request.
     */
    async resolveTransitionRequest(
        transitionRequestId: string,
        body: TransitionRequestResolveInput,
    ): Promise<TransitionRequestPatchResponse> {
        return await this.client.patch<TransitionRequestPatchResponse>(
            `/runtime/state-machine/transition-requests/${encodeURIComponent(transitionRequestId)}`,
            body,
            { operationId: 'resolveTransitionRequest' },
        );
    }

    /**
     * Replay a state-machine instance against a new configuration.
     */
    async replay(request: WorkflowReplayRequest): Promise<WorkflowReplayResponse> {
        return await this.client.post<WorkflowReplayResponse>('/runtime/state-machine/replay', request, { operationId: 'runtimeStateMachineReplay' });
    }
}
