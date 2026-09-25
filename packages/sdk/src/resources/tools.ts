// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
import { type FetchClient, localeQuery } from '../_internal/fetch-client';
import type {
    ToolCatalogResponse,
    McpToolsResponse,
    ToolCallRequest,
    ToolCallResponse,
} from '../types/tools';
import type { LocaleOptions } from '../types/locale';

export class ToolsResource {
    constructor(private readonly client: FetchClient) {}

    /**
     * Get the permission-filtered tool catalog for the authenticated user.
     * Pass `{locale}` to receive labels in that locale.
     */
    async list(options?: LocaleOptions): Promise<ToolCatalogResponse> {
        return await this.client.get<ToolCatalogResponse>('/runtime/tools', localeQuery(options), { operationId: 'runtimeToolsList' });
    }

    /**
     * Get raw MCP tool definitions filtered by user permissions.
     * Pass `{locale}` to receive descriptions in that locale.
     */
    async mcp(options?: LocaleOptions): Promise<McpToolsResponse> {
        return await this.client.get<McpToolsResponse>('/runtime/tools/mcp/list', localeQuery(options), { operationId: 'runtimeToolsMcpList' });
    }

    /**
     * Invoke an MCP tool directly by name.
     */
    async call(tool: string, parameters: Record<string, unknown>): Promise<ToolCallResponse> {
        const request: ToolCallRequest = { tool, parameters };
        return await this.client.post<ToolCallResponse>('/runtime/tools/call', request, { operationId: 'runtimeToolsCall' });
    }
}
