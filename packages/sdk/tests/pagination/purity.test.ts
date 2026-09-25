// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// The pagination module is pure: zero runtime
// imports (no dependency, no schema library) and no `as` cast at the boundary.
import { readFileSync } from 'fs';
import { join } from 'path';

const SOURCE = readFileSync(
    join(__dirname, '..', '..', 'src', '_internal', 'pagination.ts'),
    'utf8',
);

/** Strip block and line comments so assertions only see executable code. */
function stripComments(src: string): string {
    return src
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/[^\n]*/g, '');
}

const code = stripComments(SOURCE);

describe('pagination.ts purity', () => {
    it('imports nothing at runtime (zero deps)', () => {
        // The module is fully self-contained; any `import`/`require` would pull
        // in a dependency. (Type-only imports would still appear here, so the
        // strict assertion is "no import statements at all".)
        expect(code).not.toMatch(/^\s*import\b/m);
        expect(code).not.toMatch(/\brequire\s*\(/);
    });

    it('does not use a schema library', () => {
        expect(code).not.toMatch(/\bzod\b/);
    });

    it('uses no `as` type assertion at the page boundary', () => {
        // Page shapes are narrowed via typed accessor functions, never casts.
        expect(code).not.toMatch(/\bas\s+[A-Za-z]/);
    });
});
