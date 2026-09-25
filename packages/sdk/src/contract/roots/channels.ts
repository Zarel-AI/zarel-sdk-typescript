// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// contract.channels — the tenant channel-declaration collection plus its
// nested channel-ingress credentials. Distinct from the runtime-PLANE
// `client.runtime` channel-ops resource — this is contract-plane config on the
// admin host. CRUD on /contract/channels (+ /{channel_name}); the
// `credentials` sub-node is list/issue on the base and revoke on /{jti}.

import type { FetchClient } from '../../_internal/fetch-client';

type JsonObject = Record<string, unknown>;

export interface ChannelRecord {
    readonly name: string;
    readonly [key: string]: unknown;
}

/** Channel-ingress credential issuance/revocation (list + issue + revoke). */
export class ChannelCredentialsResource {
    constructor(private readonly client: FetchClient) {}

    async list(): Promise<JsonObject[]> {
        return await this.client.get('/contract/channels/credentials', undefined, { operationId: 'listChannelCredentials' });
    }

    async issue(input: JsonObject): Promise<JsonObject> {
        return await this.client.post('/contract/channels/credentials', input, { operationId: 'issueChannelCredential' });
    }

    async revoke(jti: string): Promise<void> {
        return await this.client.del<void>(`/contract/channels/credentials/${encodeURIComponent(jti)}`, { operationId: 'revokeChannelCredential' });
    }
}

export class ContractChannelsResource {
    readonly credentials: ChannelCredentialsResource;

    constructor(private readonly client: FetchClient) {
        this.credentials = new ChannelCredentialsResource(client);
    }

    async list(): Promise<ChannelRecord[]> {
        return await this.client.get('/contract/channels', undefined, { operationId: 'listChannels' });
    }

    async get(channelName: string): Promise<ChannelRecord> {
        return await this.client.get(`/contract/channels/${encodeURIComponent(channelName)}`, undefined, { operationId: 'getChannel' });
    }

    async create(input: JsonObject): Promise<ChannelRecord> {
        return await this.client.post('/contract/channels', input, { operationId: 'createChannel' });
    }

    async put(channelName: string, input: JsonObject): Promise<ChannelRecord> {
        return await this.client.put(`/contract/channels/${encodeURIComponent(channelName)}`, input, { operationId: 'replaceChannel' });
    }

    async patch(channelName: string, patch: JsonObject): Promise<ChannelRecord> {
        return await this.client.patch(`/contract/channels/${encodeURIComponent(channelName)}`, patch, { operationId: 'patchChannel' });
    }

    async delete(channelName: string): Promise<void> {
        return await this.client.del<void>(`/contract/channels/${encodeURIComponent(channelName)}`, { operationId: 'deleteChannel' });
    }
}
