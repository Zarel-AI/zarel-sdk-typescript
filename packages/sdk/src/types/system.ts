// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
export interface HealthResponse {
    status: 'healthy';
    timestamp: string;
}

export type MetricsResponse = Record<string, unknown>;

export interface ApiKeyCreateRequest {
    name: string;
    scopes?: string[];
}

export interface ApiKeyCreateResponse {
    id: string;
    name: string;
    key: string;
    scopes?: string[];
    created_at?: string;
}

export interface ApiKeyListItem {
    id: string;
    name: string;
    key_prefix: string;
    scopes?: string[];
    created_at?: string;
}

export type ApiKeyListResponse = ApiKeyListItem[];

export interface ApiKeyDeleteResponse {
    success: true;
}
