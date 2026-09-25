// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
/**
 * LLM service catalog resource.
 *
 * Read-only over the LLM service catalog, ALWAYS actor-filtered, so it does not
 * leak services the actor cannot use. The wire surface returns only services for
 * which the actor has a `use` policy in the requested scope; privileged roles see
 * everything because their YAML policies grant them `use` on every service (there
 * is no code-level role bypass).
 */

import type { FetchClient } from '../_internal/fetch-client';
import type { LocaleOptions } from '../types/locale';

// The LLM providers the Zarel API supports (gemini, anthropic, openai, bedrock).
export type LlmServiceProvider = 'anthropic' | 'bedrock' | 'gemini' | 'openai';
export type LlmServiceScope = 'runtime' | 'contract';

export interface LlmService {
    name: string;
    provider: LlmServiceProvider;
    model: string;
    priority: number;
    position: number;
    /** Per-service override; absent when null (a null is dropped, not sent). */
    temperature?: number;
    /** Per-service override; absent when null. */
    max_tokens?: number;
}

export type LlmServicesListResponse = LlmService[];

export type LlmServiceResponse = LlmService;

export interface LlmServiceQuery {
    /** REQUIRED — `runtime` or `contract`. The actor's allowlist for that scope. */
    scope: LlmServiceScope;
}

export class LlmServicesResource {
    constructor(private readonly client: FetchClient) {}

    /**
     * List the LLM services the actor is authorized to `use` in `scope`.
     * Privileged operators see the full catalog because their YAML policies
     * grant them `use` on every service.
     */
    async list(query: LlmServiceQuery, options?: LocaleOptions): Promise<LlmServicesListResponse> {
        const params = new URLSearchParams({ scope: query.scope });
        if (options?.locale) params.set('locale', options.locale);
        return await this.client.get<LlmServicesListResponse>(`/runtime/llm/services?${params.toString()}`, undefined, { operationId: 'listLlmServices' });
    }

    /**
     * Fetch a single service by name in `scope`. Returns 404 indistinguishable
     * from "doesn't exist" when the actor is not authorized.
     */
    async get(name: string, query: LlmServiceQuery, options?: LocaleOptions): Promise<LlmServiceResponse> {
        const params = new URLSearchParams({ scope: query.scope });
        if (options?.locale) params.set('locale', options.locale);
        return await this.client.get<LlmServiceResponse>(
            `/runtime/llm/services/${encodeURIComponent(name)}?${params.toString()}`,
            undefined,
            { operationId: 'getLlmService' },
        );
    }
}
