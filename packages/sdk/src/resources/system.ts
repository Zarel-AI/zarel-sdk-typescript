// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
import type { FetchClient } from '../_internal/fetch-client';
import type {
    HealthResponse,
    MetricsResponse,
    ApiKeyCreateRequest,
    ApiKeyCreateResponse,
    ApiKeyListResponse,
    ApiKeyDeleteResponse,
} from '../types/system';

export class SystemResource {
    constructor(private readonly client: FetchClient) {}

    async health(): Promise<HealthResponse> {
        return await this.client.get<HealthResponse>('/health', undefined, { operationId: 'getHealth' });
    }

    async metrics(): Promise<MetricsResponse> {
        return await this.client.get<MetricsResponse>('/metrics', undefined, { operationId: 'getMetrics' });
    }

    async createApiKey(request: ApiKeyCreateRequest): Promise<ApiKeyCreateResponse> {
        return await this.client.post<ApiKeyCreateResponse>('/api-keys', request, { operationId: 'createApiKey' });
    }

    async listApiKeys(): Promise<ApiKeyListResponse> {
        return await this.client.get<ApiKeyListResponse>('/api-keys', undefined, { operationId: 'listApiKeys' });
    }

    async deleteApiKey(keyId: string): Promise<ApiKeyDeleteResponse> {
        return await this.client.del<ApiKeyDeleteResponse>(`/api-keys/${encodeURIComponent(keyId)}`, { operationId: 'deleteApiKey' });
    }
}
