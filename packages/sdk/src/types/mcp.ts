// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// MCP JSON-RPC transport types.
//
// `client.runtime.mcp.call` speaks the MCP "Streamable HTTP" transport
// (POST /runtime/mcp, stateless, one logical JSON-RPC response per request).
// These are hand-authored (zero runtime deps — no @modelcontextprotocol/sdk):
// the OpenAPI types the body/response as opaque objects, so there is nothing to
// codegen, and MCP methods are open (not enumerated) → `result`/`error.data`
// stay `unknown`. The response is a discriminated union over `result` xor
// `error`; callers discriminate with `'error' in response`.

/** A single MCP JSON-RPC 2.0 request message. */
export interface McpJsonRpcRequest {
    jsonrpc: '2.0';
    /** Omitted for notifications. */
    id?: string | number;
    /** e.g. `initialize`, `tools/list`, `tools/call`. */
    method: string;
    params?: Record<string, unknown>;
}

/** A successful MCP JSON-RPC response. */
export interface McpJsonRpcSuccess {
    jsonrpc: '2.0';
    id: string | number | null;
    /** Method-agnostic — per-method typing is out of scope. */
    result: unknown;
}

/** A protocol-level MCP JSON-RPC error (returned in the union, NOT thrown). */
export interface McpJsonRpcError {
    jsonrpc: '2.0';
    id: string | number | null;
    error: { code: number; message: string; data?: unknown };
}

export type McpJsonRpcResponse = McpJsonRpcSuccess | McpJsonRpcError;
