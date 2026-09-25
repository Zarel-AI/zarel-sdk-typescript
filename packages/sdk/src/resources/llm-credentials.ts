// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
/**
 * LLM credential management resource.
 *
 * Write-only on `apiKey`: `put` accepts plaintext but no read endpoint EVER
 * returns it. `get` / `list` return only metadata (`credential_masked` is the
 * fingerprint wrapped in dots; never the plaintext).
 *
 * Authorization: every method requires the tenant-wide `manage_credentials`
 * runtime system action (there is no per-service `manage_credential`). The wire
 * surface returns 404 indistinguishable from "doesn't exist" when the actor is
 * unauthorized, so it does not leak which credentials exist.
 */

import { type FetchClient, localeQuery } from '../_internal/fetch-client';
import type { LocaleOptions } from '../types/locale';

export interface LlmCredentialMetadata {
    service_name: string;
    /** "••••" + last 4 chars of the plaintext fingerprint. Read-only. */
    credential_masked: string;
    created_by: string;
    updated_by: string;
    created_at: string;
    updated_at: string;
}

export type LlmCredentialsListResponse = LlmCredentialMetadata[];

export type LlmCredentialResponse = LlmCredentialMetadata;

/** apiKey providers (gemini, openai, anthropic). */
export interface LlmApiKeyCredentialInput {
    /** Plaintext API key. Sent over TLS, encrypted server-side, never echoed. */
    apiKey: string;
    /** Optional base URL override (self-hosted endpoints). The wire field is `baseURL`; this
     *  accessor renames it, which is the one place the two spellings meet. */
    baseUrl?: string;
}

/** Amazon Bedrock — static AWS credentials. */
export interface LlmAwsCredentialInput {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
    sessionToken?: string;
}

/**
 * A UNION of the two credential shapes: an api-key credential, or static AWS credentials for a
 * `bedrock` service. It matches `EmbeddingCredentialPutInput`, which carries the same two
 * arms.
 */
export type LlmCredentialPutInput = LlmApiKeyCredentialInput | LlmAwsCredentialInput;

export class LlmCredentialsResource {
    constructor(private readonly client: FetchClient) {}

    /** List metadata for credentials (requires tenant-wide `manage_credentials`). */
    async list(options?: LocaleOptions): Promise<LlmCredentialsListResponse> {
        return await this.client.get<LlmCredentialsListResponse>('/runtime/llm/credentials', localeQuery(options), { operationId: 'listLlmCredentials' });
    }

    /** Fetch masked metadata for one credential. 404 if not authorized. */
    async get(serviceName: string, options?: LocaleOptions): Promise<LlmCredentialResponse> {
        return await this.client.get<LlmCredentialResponse>(
            `/runtime/llm/credentials/${encodeURIComponent(serviceName)}`,
            localeQuery(options),
            { operationId: 'getLlmCredential' },
        );
    }

    /** Set / replace the credential. Idempotent UPSERT. */
    async put(serviceName: string, input: LlmCredentialPutInput): Promise<LlmCredentialResponse> {
        // SPREAD, not a hand-built literal — the same shape the embedding twin uses. Naming the
        // keys here would silently drop every arm but one, and the server schema refuses a key it
        // does not declare with a 400, so forwarding exactly what the caller passed is the only
        // way this accessor and that schema can agree.
        const body: Record<string, unknown> = { ...input };
        if ('baseUrl' in input) {
            // THE DELETE IS UNCONDITIONAL, the assignment is not. `put(name, { apiKey, baseUrl:
            // opts.baseUrl })` with an undefined `opts.baseUrl` leaves the KEY present after the
            // spread, and the server refuses `baseUrl` as an unrecognized key. `FetchClient`
            // happening to `JSON.stringify` the body, which drops undefined values, would hide
            // that — a coincidence this accessor should not depend on, and one that a `null`
            // instead of an `undefined` does not save.
            delete body.baseUrl;
            if (input.baseUrl !== undefined) body.baseURL = input.baseUrl;
        }
        return await this.client.put<LlmCredentialResponse>(
            `/runtime/llm/credentials/${encodeURIComponent(serviceName)}`,
            body,
            { operationId: 'setLlmCredential' },
        );
    }

    /**
     * Remove the credential. Returns 409 `CREDENTIAL_IN_USE` if any active
     * session is pinned to the service — close those sessions first.
     */
    async delete(serviceName: string): Promise<void> {
        await this.client.del(
            `/runtime/llm/credentials/${encodeURIComponent(serviceName)}`,
            { operationId: 'deleteLlmCredential' },
        );
    }
}
