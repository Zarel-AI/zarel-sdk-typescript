// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// runtime.mcp.call.
//
// Types the MCP "Streamable HTTP" transport (POST /runtime/mcp, stateless
// JSON-RPC). Sends one MCP JSON-RPC message and
// returns the typed response, de-framing either an application/json body or a
// single text/event-stream frame. Bare JSON-RPC — NOT the {success,data}
// envelope. A protocol-level JSON-RPC error is returned in the union (callers
// discriminate with `'error' in res`); transport failures throw. Single
// attempt — no retry (tools/call may be a non-idempotent mutation). For a full
// MCP client (sessions, server-push) use @modelcontextprotocol/sdk; this is a
// thin, zero-dependency one-shot call.

import type { FetchClient } from '../_internal/fetch-client';
import type { McpJsonRpcRequest, McpJsonRpcResponse } from '../types/mcp';

export class McpResource {
    constructor(private readonly client: FetchClient) {}

    call(message: McpJsonRpcRequest): Promise<McpJsonRpcResponse> {
        return this.client.postMcp('/runtime/mcp', message);
    }
}
