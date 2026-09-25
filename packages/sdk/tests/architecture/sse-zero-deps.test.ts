// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// The SSE helper adds ZERO runtime dependencies. Its modules import
// only native globals + relative SDK files; the SDK's `dependencies` stay empty.
import { readFileSync } from 'fs';
import { join } from 'path';

const SRC = join(__dirname, '..', '..', 'src');
const SSE_MODULES = ['_internal/sse-client.ts', 'types/events-stream.ts'];

function importSpecifiers(source: string): string[] {
    const specs: string[] = [];
    const re = /(?:import|export)[^'"]*from\s*['"]([^'"]+)['"]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(source)) !== null) specs.push(m[1]!);
    return specs;
}

describe('SSE helper has zero runtime dependencies', () => {
    it('imports only relative modules (no third-party packages, incl. zod)', () => {
        for (const mod of SSE_MODULES) {
            const specs = importSpecifiers(readFileSync(join(SRC, mod), 'utf8'));
            const external = specs.filter((s) => !s.startsWith('.'));
            expect({ mod, external }).toEqual({ mod, external: [] });
        }
    });

    it('keeps the SDK runtime dependencies empty (no eventsource/zod added)', () => {
        const pkg = JSON.parse(readFileSync(join(SRC, '..', 'package.json'), 'utf8')) as {
            dependencies?: Record<string, string>;
        };
        expect(Object.keys(pkg.dependencies ?? {})).toHaveLength(0);
    });
});
