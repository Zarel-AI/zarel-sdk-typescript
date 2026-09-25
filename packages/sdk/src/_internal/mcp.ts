// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// Pure extraction of an MCP JSON-RPC response from the dual
// content-type body (application/json OR a single text/event-stream frame).
// Zero runtime deps: reuses the pure SSE frame parser; validates the JSON-RPC
// shape with a hand-written type-guard (no Zod, no `as` beyond the
// unknown→record narrowing the transport's envelope-shape guard already uses).

import { ZarelError } from '../errors';
import type { McpJsonRpcResponse } from '../types/mcp';
import { parseSseFrames } from './sse-client';

function isValidError(value: unknown): value is { code: number; message: string } {
    if (typeof value !== 'object' || value === null) return false;
    const obj = value as Record<string, unknown>;
    return typeof obj.code === 'number' && typeof obj.message === 'string';
}

/**
 * A parsed body is a JSON-RPC response iff it is an object with a present `id`
 * (string | number | null) and EXACTLY ONE of a present `result` (any value) or
 * a well-formed `error` member. Keying on id + (result xor error) — rather than
 * on `jsonrpc` — tolerates a server that omits the version field while rejecting
 * a non-JSON-RPC body (e.g. a stray `{success,data}` envelope or an HTML page).
 */
function isMcpJsonRpcResponse(value: unknown): value is McpJsonRpcResponse {
    if (typeof value !== 'object' || value === null) return false;
    const obj = value as Record<string, unknown>;
    if (!Object.prototype.hasOwnProperty.call(obj, 'id')) return false;
    const id = obj.id;
    if (!(typeof id === 'string' || typeof id === 'number' || id === null)) return false;
    const hasResult = Object.prototype.hasOwnProperty.call(obj, 'result');
    const hasError = Object.prototype.hasOwnProperty.call(obj, 'error') && isValidError(obj.error);
    return hasResult !== hasError;
}

/** Pull the first non-empty `data` payload out of an SSE body. */
function extractSseData(body: string): string {
    // Whole-body (non-streaming) parse: `parseSseFrames` only emits blocks closed
    // by a blank line, leaving any unterminated trailing block in `carry`. A
    // single final `data:` frame sent without the closing `\n\n` would otherwise
    // be dropped — flush it by re-feeding `carry` with a terminator.
    const { frames, carry } = parseSseFrames(body, '');
    const allFrames = carry.trim() === ''
        ? frames
        : [...frames, ...parseSseFrames('\n\n', carry).frames];
    for (const frame of allFrames) {
        if (frame.data !== '') return frame.data;
    }
    throw new ZarelError('MCP SSE response contained no data frame');
}

/**
 * Extract the typed JSON-RPC response from an MCP transport reply. The server
 * frames `text/event-stream` as a single `message` data frame; everything else
 * (application/json, or a JSON body with no/odd content-type) is parsed
 * directly. A protocol-level JSON-RPC error is RETURNED in the union (the caller
 * discriminates with `'error' in res`); a body that is not a valid JSON-RPC
 * response throws `ZarelError`.
 */
export function extractMcpResponse(contentType: string | null, bodyText: string): McpJsonRpcResponse {
    const isSse = contentType !== null && contentType.includes('text/event-stream');
    const jsonText = isSse ? extractSseData(bodyText) : bodyText;
    if (jsonText.trim() === '') {
        throw new ZarelError('MCP response body is empty');
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(jsonText);
    } catch {
        throw new ZarelError('MCP response body is not valid JSON');
    }
    if (!isMcpJsonRpcResponse(parsed)) {
        throw new ZarelError('MCP response is not a valid JSON-RPC response');
    }
    return parsed;
}
