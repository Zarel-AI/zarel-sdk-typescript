// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// The published SDK ships ZERO runtime dependencies (the
// lightweight invariant @zarel-ai/react relies on).
import { readFileSync } from 'fs';
import { join } from 'path';

const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
};

describe('zero runtime dependencies', () => {
    it('has no (or empty) runtime dependencies', () => {
        expect(Object.keys(pkg.dependencies ?? {})).toHaveLength(0);
    });
});
