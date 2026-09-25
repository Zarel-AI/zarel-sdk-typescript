// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// The contract roots. These are hoisted onto `client.contract.*` directly: there
// is no `contract.runtime` namespace, because there is no `runtime:` section for
// it to mirror.
//
// They live on the CONTRACT host (`{tenant}.admin.zarel…`) and remain distinct
// from the runtime-PLANE namespace `client.runtime.*`, which is a different
// surface on a different host (`runtime` names the plane and the scope
// qualifier).

import type { FetchClient } from '../../_internal/fetch-client';
import { SingletonAccessor, type JsonObject } from '../_singleton';
import type { ContractLlmPatchPayload, ContractLlmWritePayload } from '../../generated';
import { McpServersResource } from './mcp-servers';
import { TreatmentResource } from './treatment';
import { TimezoneResource } from './timezone';
import { ContractChannelsResource } from './channels';

export class ContractAgentRoots {
    // The GLOBAL TUNABLES. `services[]` is the catalog and this body refuses it by name.
    // The read stays untyped: `getLlm` publishes a bare `OkEnvelope`.
    readonly llm: SingletonAccessor<JsonObject, ContractLlmWritePayload, ContractLlmPatchPayload>;
    readonly treatment: TreatmentResource;
    readonly mcpServers: McpServersResource;
    readonly timezone: TimezoneResource;
    readonly channels: ContractChannelsResource;

    constructor(client: FetchClient) {
        this.llm = new SingletonAccessor<JsonObject, ContractLlmWritePayload, ContractLlmPatchPayload>(
            client,
            '/contract/llm',
            { get: 'getLlm', put: 'putLlm', patch: 'patchLlm' },
        );
        this.treatment = new TreatmentResource(client);
        // `embeddings` has no accessor here: like its sibling `llm.services[]`, it is authored
        // through contract import and read back through export. There is no single-document
        // endpoint for it.
        this.mcpServers = new McpServersResource(client);
        this.timezone = new TimezoneResource(client);
        this.channels = new ContractChannelsResource(client);
    }
}
