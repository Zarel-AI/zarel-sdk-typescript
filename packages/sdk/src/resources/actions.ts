// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
import type { FetchClient } from '../_internal/fetch-client';
import { confirmationHeaders } from '../_internal/confirmation';
import type { ActionDispatchParams, ActionDispatchSuccessResponse } from '../types/actions';
import type { ConfirmationRetryOptions } from '../types/confirmation';

export type { ActionDispatchParams, ActionDispatchSuccessResponse };

/**
 * Dispatch surface for YAML-declared `action.<name>` intents.
 *
 * Backs the `POST /runtime/actions/:name` route. The server runs the action as
 * the entity operation it declares, with the same authorization, validation,
 * state-machine checks and side effects as a direct entity write.
 *
 * Errors surface as `ZarelAPIError` with `code` set to one of:
 *   `unknown_action`         (404) — action name not in tenant contract
 *   `action_unauthorized`    (403) — user lacks underlying (entity, verb) capability
 *   `precondition_failed`    (422) — YAML preconditions evaluated false
 *   `validation_error`       (400) — payload schema mismatch
 *   `confirmation_required`  (409) — a `confirm` guard paused the write; the
 *                                    error carries `confirmation`
 */
export class ActionsResource {
    constructor(private readonly client: FetchClient) {}

    /**
     * Dispatch an action. On `409 confirmation_required` the thrown
     * `ZarelAPIError` carries `.confirmation`; show the human EVERY
     * `guards[].prompt` and call this again with the SAME `params` plus
     * `{ confirmationToken: challenge.token }`. The token binds the request as
     * submitted, so an edited retry is a different write and is challenged anew.
     */
    async dispatch(
        actionName: string,
        params?: ActionDispatchParams,
        options?: ConfirmationRetryOptions,
    ): Promise<ActionDispatchSuccessResponse> {
        const body: Record<string, unknown> = {};
        if (params?.record_id !== undefined) body.record_id = params.record_id;
        // `notes` is not in the published schema and is ignored by the runtime;
        // still forwarded for the react confirm dialog.
        if (params?.notes !== undefined) body.notes = params.notes;
        if (params?.payload !== undefined) body.payload = params.payload;
        if (params?.idempotency_key !== undefined) body.idempotency_key = params.idempotency_key;

        // The dispatch response carries `resolved_via_action` ALONGSIDE the
        // {success,data} envelope, so opt out of the transport unwrap and
        // return the full envelope body as ActionDispatchSuccessResponse.
        return await this.client.post<ActionDispatchSuccessResponse>(
            `/runtime/actions/${encodeURIComponent(actionName)}`,
            body,
            { operationId: 'dispatchAction', headers: confirmationHeaders(options?.confirmationToken) },
        );
    }
}
