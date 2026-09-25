// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// Pure de-framing of the MCP JSON-RPC response.
import { extractMcpResponse } from '../../src/_internal/mcp';
import { ZarelError } from '../../src/errors';

const sseFrame = (data: string): string => `event: message\ndata: ${data}\n\n`;

describe('extractMcpResponse — content-type branching', () => {
    it('parses an application/json JSON-RPC success body', () => {
        const res = extractMcpResponse('application/json', JSON.stringify({ jsonrpc: '2.0', id: 1, result: { tools: [] } }));
        expect('error' in res).toBe(false);
        if (!('error' in res)) expect(res.result).toEqual({ tools: [] });
        expect(res.id).toBe(1);
    });

    it('parses application/json with a charset suffix', () => {
        const res = extractMcpResponse('application/json; charset=utf-8', JSON.stringify({ jsonrpc: '2.0', id: 'a', result: null }));
        expect('error' in res).toBe(false);
    });

    it('de-frames a single text/event-stream message frame', () => {
        const body = sseFrame(JSON.stringify({ jsonrpc: '2.0', id: 2, result: { ok: true } }));
        const res = extractMcpResponse('text/event-stream', body);
        expect('error' in res).toBe(false);
        if (!('error' in res)) expect(res.result).toEqual({ ok: true });
    });

    it('de-frames a final SSE frame sent without a trailing blank-line terminator', () => {
        // A whole-body parse must flush the last block even if the server closed
        // the stream after `data: …\n` without the closing `\n\n` (carry flush).
        const body = `event: message\ndata: ${JSON.stringify({ jsonrpc: '2.0', id: 9, result: { ok: true } })}\n`;
        const res = extractMcpResponse('text/event-stream', body);
        expect('error' in res).toBe(false);
        if (!('error' in res)) expect(res.result).toEqual({ ok: true });
    });

    it('de-frames an SSE frame preceded by a comment/heartbeat line', () => {
        const body = ':hb\n\n' + sseFrame(JSON.stringify({ jsonrpc: '2.0', id: 3, result: 1 }));
        const res = extractMcpResponse('text/event-stream', body);
        expect('error' in res).toBe(false);
    });

    it('returns the FIRST data frame when multiple are present', () => {
        const body = sseFrame(JSON.stringify({ jsonrpc: '2.0', id: 1, result: 'first' }))
            + sseFrame(JSON.stringify({ jsonrpc: '2.0', id: 2, result: 'second' }));
        const res = extractMcpResponse('text/event-stream', body);
        if (!('error' in res)) expect(res.result).toBe('first');
    });
});

describe('extractMcpResponse — protocol error is returned, not thrown', () => {
    it('returns the error arm for a 200 JSON-RPC error body (json)', () => {
        const res = extractMcpResponse('application/json', JSON.stringify({ jsonrpc: '2.0', id: 1, error: { code: -32601, message: 'Method not found' } }));
        expect('error' in res).toBe(true);
        if ('error' in res) {
            expect(res.error.code).toBe(-32601);
            expect(res.error.message).toBe('Method not found');
        }
    });

    it('returns the error arm for an SSE-framed error', () => {
        const body = sseFrame(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -1, message: 'boom' } }));
        const res = extractMcpResponse('text/event-stream', body);
        expect('error' in res).toBe(true);
    });
});

describe('extractMcpResponse — malformed → ZarelError', () => {
    it('throws on an empty body', () => {
        expect(() => extractMcpResponse('application/json', '')).toThrow(ZarelError);
    });

    it('throws on an SSE stream with no message data frame', () => {
        expect(() => extractMcpResponse('text/event-stream', ':heartbeat\n\n')).toThrow(ZarelError);
    });

    it('throws on an SSE message frame with empty data', () => {
        expect(() => extractMcpResponse('text/event-stream', 'event: message\ndata: \n\n')).toThrow(ZarelError);
    });

    it('throws on a non-JSON-RPC JSON body (e.g. a stray envelope)', () => {
        expect(() => extractMcpResponse('application/json', JSON.stringify({ success: true, data: {} }))).toThrow(ZarelError);
    });

    it('throws on a non-JSON body (HTML slipped a 200)', () => {
        expect(() => extractMcpResponse('text/html', '<html>oops</html>')).toThrow(ZarelError);
    });

    it('throws on a body that is valid JSON but neither result nor error', () => {
        expect(() => extractMcpResponse('application/json', JSON.stringify({ jsonrpc: '2.0', id: 1 }))).toThrow(ZarelError);
    });

    it('throws on an error member missing a numeric code', () => {
        expect(() => extractMcpResponse('application/json', JSON.stringify({ jsonrpc: '2.0', id: 1, error: { message: 'x' } }))).toThrow(ZarelError);
    });
});
