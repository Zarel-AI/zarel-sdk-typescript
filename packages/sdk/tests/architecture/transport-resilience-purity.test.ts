// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// The resilience-headers + interceptor modules add ZERO
// runtime dependencies and use no `as` cast at the parsing boundary. They import
// only native globals + relative SDK files (the `import type { HttpMethod }` in
// interceptors.ts is type-only / erased); the SDK's `dependencies` stay empty.
import { readFileSync } from 'fs';
import { join } from 'path';

const SRC = join(__dirname, '..', '..', 'src');
const MODULES = ['_internal/retry-after.ts', '_internal/version.ts', '_internal/interceptors.ts'];

function stripComments(src: string): string {
    return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

function importSpecifiers(source: string): string[] {
    const specs: string[] = [];
    const re = /(?:import|export)[^'"]*from\s*['"]([^'"]+)['"]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(source)) !== null) {
        const captured = m[1];
        if (captured !== undefined) specs.push(captured);
    }
    return specs;
}

describe('transport resilience modules are pure', () => {
    it('import only relative modules (no third-party packages, incl. zod)', () => {
        for (const mod of MODULES) {
            const specs = importSpecifiers(readFileSync(join(SRC, mod), 'utf8'));
            const external = specs.filter((s) => !s.startsWith('.'));
            expect({ mod, external }).toEqual({ mod, external: [] });
        }
    });

    it('use no schema library (no zod) and no require()', () => {
        for (const mod of MODULES) {
            const code = stripComments(readFileSync(join(SRC, mod), 'utf8'));
            expect({ mod, hasZod: /\bzod\b/.test(code) }).toEqual({ mod, hasZod: false });
            expect({ mod, hasRequire: /\brequire\s*\(/.test(code) }).toEqual({ mod, hasRequire: false });
        }
    });

    it('parseRetryAfter narrows the header with no `as` cast', () => {
        const code = stripComments(readFileSync(join(SRC, '_internal/retry-after.ts'), 'utf8'));
        expect(code).not.toMatch(/\bas\s+[A-Za-z]/);
    });

    it('keeps the SDK runtime dependencies empty', () => {
        const pkg = JSON.parse(readFileSync(join(SRC, '..', 'package.json'), 'utf8')) as {
            dependencies?: Record<string, string>;
        };
        expect(Object.keys(pkg.dependencies ?? {})).toHaveLength(0);
    });
});
