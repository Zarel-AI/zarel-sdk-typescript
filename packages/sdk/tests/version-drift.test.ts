// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// The SDK_VERSION literal MUST match the package version. The
// User-Agent string is built from SDK_VERSION; a hand-maintained constant that
// drifts from package.json would mislabel every request. This test fails on drift.
import { readFileSync } from 'fs';
import { join } from 'path';

import { SDK_VERSION, USER_AGENT } from '../src/_internal/version';

const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8')) as {
    version: string;
};

describe('version drift-guard', () => {
    it('SDK_VERSION matches package.json version', () => {
        expect(SDK_VERSION).toBe(pkg.version);
    });

    it('USER_AGENT embeds the package version', () => {
        expect(USER_AGENT).toBe(`@zarel-ai/sdk/${pkg.version}`);
    });
});
