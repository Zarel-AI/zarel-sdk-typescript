// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
/**
 * Embedding credential management resource.
 *
 * Per-(tenant, declared embedding service) credentials — keyed on the name from
 * `embeddings.services[]`, never the provider, which is not an identity
 * and is resolved server-side from that declaration. Write-only on the secret:
 * `put` accepts the credential blob but no read endpoint ever returns it; `get` /
 * `list` return only masked metadata.
 *
 * Authorization: tenant-level superuser. The wire surface returns 404
 * indistinguishable from "not configured" when unauthorized, and an
 * empty list from `list`.
 */

import { type FetchClient, localeQuery } from '../_internal/fetch-client';
import type { LocaleOptions } from '../types/locale';

export interface EmbeddingCredentialMetadata {
    tenant_name: string;
    /** The declared `embeddings.services[].name` this credential keys to. */
    service_name: string;
    /** "••••" + the credential fingerprint. Read-only; never the secret. */
    credential_masked: string;
    created_by: string;
    updated_by: string;
    created_at: string;
    updated_at: string;
}

export type EmbeddingCredentialsListResponse = EmbeddingCredentialMetadata[];

export type EmbeddingCredentialResponse = EmbeddingCredentialMetadata;

/** apiKey providers (gemini, openai, anthropic-via-Voyage). */
export interface EmbeddingApiKeyCredentialInput {
    apiKey: string;
    baseUrl?: string;
}

/** Amazon Bedrock — static AWS credentials. */
export interface EmbeddingAwsCredentialInput {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
    sessionToken?: string;
}

export type EmbeddingCredentialPutInput = EmbeddingApiKeyCredentialInput | EmbeddingAwsCredentialInput;

export class EmbeddingCredentialsResource {
    constructor(private readonly client: FetchClient) {}

    /** List masked metadata for every stored embedding-service credential. */
    async list(options?: LocaleOptions): Promise<EmbeddingCredentialsListResponse> {
        return await this.client.get<EmbeddingCredentialsListResponse>('/runtime/embedding-credentials', localeQuery(options), { operationId: 'listEmbeddingCredentials' });
    }

    /** Fetch masked metadata for one declared service's credential. 404 if not authorized / not configured. */
    async get(serviceName: string, options?: LocaleOptions): Promise<EmbeddingCredentialResponse> {
        return await this.client.get<EmbeddingCredentialResponse>(
            `/runtime/embedding-credentials/${encodeURIComponent(serviceName)}`,
            localeQuery(options),
            { operationId: 'getEmbeddingCredential' },
        );
    }

    /**
     * Set / replace a declared service's credential. Idempotent UPSERT.
     *
     * `serviceName` is the `embeddings.services[].name` the contract declares;
     * the server resolves its provider and validates `input` against that
     * provider's schema, so the blob shape follows the DECLARATION, not the path.
     */
    async put(serviceName: string, input: EmbeddingCredentialPutInput): Promise<EmbeddingCredentialResponse> {
        const body: Record<string, unknown> = { ...input };
        // Mirror the LLM resource's apiKey casing (wire field is `baseURL`).
        if ('baseUrl' in input && input.baseUrl !== undefined) {
            delete body.baseUrl;
            body.baseURL = input.baseUrl;
        }
        return await this.client.put<EmbeddingCredentialResponse>(
            `/runtime/embedding-credentials/${encodeURIComponent(serviceName)}`,
            body,
            { operationId: 'setEmbeddingCredential' },
        );
    }

    /** Remove a declared service's credential (soft-delete + sensitive wipe). */
    async delete(serviceName: string): Promise<void> {
        await this.client.del(`/runtime/embedding-credentials/${encodeURIComponent(serviceName)}`, { operationId: 'deleteEmbeddingCredential' });
    }
}
