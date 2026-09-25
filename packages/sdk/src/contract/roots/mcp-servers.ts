// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// contract.admin.mcpServers (servers + nested allowedTools).
//
// Maps to the contract API's `/contract/mcp-servers*` and
// `/contract/mcp-servers/:namespace/allowed-tools*`. The `/contract/` URL
// prefix marks the contract-plane host; the resource configures runtime
// behaviour.
//
// The two record types and the four body types are DERIVED from the published schema — see
// `../../types/mcp-and-events-contract`.

import type { FetchClient } from '../../_internal/fetch-client';
import type {
    McpAllowedToolCreate,
    McpAllowedToolRecord,
    McpAllowedToolWrite,
    McpServerCreate,
    McpServerRecord,
    McpServerWrite,
} from '../../types/mcp-and-events-contract';
import type { ContractDeletedAck } from '../../types/flows-contract';

export type {
    McpAllowedToolCreate, McpAllowedToolRecord, McpAllowedToolWrite,
    McpServerCreate, McpServerRecord, McpServerWrite,
};

class McpAllowedTools {
    constructor(private readonly client: FetchClient, private readonly ns: string) {}

    private base(): string {
        return `/contract/mcp-servers/${encodeURIComponent(this.ns)}/allowed-tools`;
    }

    async list(): Promise<McpAllowedToolRecord[]> {
        return await this.client.get(this.base(), undefined, { operationId: 'listMcpAllowedTools' });
    }

    async get(toolName: string): Promise<McpAllowedToolRecord> {
        return await this.client.get(`${this.base()}/${encodeURIComponent(toolName)}`, undefined, { operationId: 'getMcpAllowedTool' });
    }

    async create(input: McpAllowedToolCreate): Promise<McpAllowedToolRecord> {
        return await this.client.post(this.base(), input, { operationId: 'createMcpAllowedTool' });
    }

    async put(toolName: string, input: McpAllowedToolWrite): Promise<McpAllowedToolRecord> {
        return await this.client.put(`${this.base()}/${encodeURIComponent(toolName)}`, input, { operationId: 'replaceMcpAllowedTool' });
    }

    async patch(toolName: string, patch: McpAllowedToolWrite): Promise<McpAllowedToolRecord> {
        return await this.client.patch(`${this.base()}/${encodeURIComponent(toolName)}`, patch, { operationId: 'patchMcpAllowedTool' });
    }

    async delete(toolName: string): Promise<ContractDeletedAck> {
        return await this.client.del<ContractDeletedAck>(`${this.base()}/${encodeURIComponent(toolName)}`, { operationId: 'deleteMcpAllowedTool' });
    }
}

export class McpServersResource {
    constructor(private readonly client: FetchClient) {}

    async list(): Promise<McpServerRecord[]> {
        return await this.client.get('/contract/mcp-servers', undefined, { operationId: 'listMcpServers' });
    }

    async get(namespace: string): Promise<McpServerRecord> {
        return await this.client.get(`/contract/mcp-servers/${encodeURIComponent(namespace)}`, undefined, { operationId: 'getMcpServer' });
    }

    async create(input: McpServerCreate): Promise<McpServerRecord> {
        return await this.client.post('/contract/mcp-servers', input, { operationId: 'createMcpServer' });
    }

    async put(namespace: string, input: McpServerWrite): Promise<McpServerRecord> {
        return await this.client.put(`/contract/mcp-servers/${encodeURIComponent(namespace)}`, input, { operationId: 'replaceMcpServer' });
    }

    async patch(namespace: string, patch: McpServerWrite): Promise<McpServerRecord> {
        return await this.client.patch(`/contract/mcp-servers/${encodeURIComponent(namespace)}`, patch, { operationId: 'patchMcpServer' });
    }

    async delete(namespace: string): Promise<ContractDeletedAck> {
        return await this.client.del<ContractDeletedAck>(`/contract/mcp-servers/${encodeURIComponent(namespace)}`, { operationId: 'deleteMcpServer' });
    }

    allowedTools(namespace: string): McpAllowedTools {
        return new McpAllowedTools(this.client, namespace);
    }
}
