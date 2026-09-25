// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// Structural invariants for runtime.mcp.call.
import { readFileSync } from 'fs';
import { join } from 'path';

const SRC = join(__dirname, '..', 'src');
const read = (rel: string): string => readFileSync(join(SRC, rel), 'utf8');

describe('single Bearer authority (no new Bearer site on the MCP path)', () => {
    it('the MCP transport files never build a Bearer header themselves', () => {
        expect(read('_internal/mcp.ts')).not.toContain('Bearer');
        expect(read('resources/mcp.ts')).not.toContain('Bearer');
    });

    it('postMcp resolves auth via the shared resolveAuthHeaders authority', () => {
        const fc = read('_internal/fetch-client.ts');
        // The postMcp method body must call resolveAuthHeaders (the single authority).
        const postMcp = fc.slice(fc.indexOf('async postMcp('));
        expect(postMcp).toContain('resolveAuthHeaders(');
        // ...and must NOT mint its own Bearer string.
        const postMcpBody = postMcp.slice(0, postMcp.indexOf('private async fetchWithTimeout'));
        expect(postMcpBody).not.toContain('Bearer ');
    });
});

describe('no envelope-unwrap on the MCP path', () => {
    it('the pure de-framer never references unwrapEnvelope', () => {
        expect(read('_internal/mcp.ts')).not.toContain('unwrapEnvelope');
    });

    it('postMcp does not run the envelope unwrap', () => {
        const fc = read('_internal/fetch-client.ts');
        const postMcp = fc.slice(fc.indexOf('async postMcp('), fc.indexOf('private async fetchWithTimeout'));
        expect(postMcp).not.toContain('unwrapEnvelope');
        // It delegates to the pure JSON-RPC extractor instead.
        expect(postMcp).toContain('extractMcpResponse(');
    });
});

describe('zero runtime deps; no MCP/SSE/validation import', () => {
    it('the SDK package declares no runtime dependencies', () => {
        const pkg = JSON.parse(readFileSync(join(SRC, '..', 'package.json'), 'utf8')) as {
            dependencies?: Record<string, string>;
        };
        const deps = pkg.dependencies ?? {};
        expect(Object.keys(deps)).toHaveLength(0);
    });

    it('the new MCP source files import no @modelcontextprotocol/eventsource/zod', () => {
        // Match actual import specifiers, not comment mentions (the files document
        // that they deliberately do NOT depend on @modelcontextprotocol/sdk).
        const importFrom = /from\s+['"]([^'"]+)['"]/g;
        for (const f of ['_internal/mcp.ts', 'types/mcp.ts', 'resources/mcp.ts']) {
            const src = read(f);
            const specifiers = [...src.matchAll(importFrom)].map((m) => m[1]);
            for (const spec of specifiers) {
                expect(spec).not.toMatch(/@modelcontextprotocol|eventsource|^zod$/);
            }
        }
    });
});

describe('clean cut (no dead /runtime/mcp/stream path or .stream accessor)', () => {
    it('the MCP resource exposes call, not stream', () => {
        const res = read('resources/mcp.ts');
        expect(res).toContain('call(');
        expect(res).not.toMatch(/\bstream\s*\(/);
    });

    it('no live SDK source (excluding generated codegen) references the dead path', () => {
        // generated/runtime.ts mirrors the OpenAPI op description (generated code)
        // — excluded by design.
        expect(read('_internal/mcp.ts')).not.toContain('/runtime/mcp/stream');
        expect(read('resources/mcp.ts')).not.toContain('/runtime/mcp/stream');
        expect(read('_internal/fetch-client.ts')).not.toContain('/runtime/mcp/stream');
    });
});
