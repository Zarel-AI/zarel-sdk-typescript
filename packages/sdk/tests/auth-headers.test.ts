// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// The shared auth authority used by BOTH the REST FetchClient and
// the SSE stream client. The second suite is a structural check: exactly
// one `Bearer ` header-building site exists in src/.
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { resolveAuthHeaders } from '../src/_internal/auth-headers';
import { ZarelAuthError } from '../src/errors';

describe('resolveAuthHeaders', () => {
    it('builds a Bearer header for a static string token', async () => {
        expect(await resolveAuthHeaders('tok', false)).toEqual({ Authorization: 'Bearer tok' });
    });

    it('resolves a provider token (sync and async)', async () => {
        expect(await resolveAuthHeaders(() => 'sync', false)).toEqual({ Authorization: 'Bearer sync' });
        expect(await resolveAuthHeaders(() => Promise.resolve('async'), false)).toEqual({ Authorization: 'Bearer async' });
    });

    it('omits Authorization in transport-managed mode (and skips the guard)', async () => {
        expect(await resolveAuthHeaders('', true, 'runtime_token_missing')).toEqual({});
        expect(await resolveAuthHeaders('ignored', true)).toEqual({});
    });

    it('omits Authorization for an empty direct token (no guard code)', async () => {
        expect(await resolveAuthHeaders('', false)).toEqual({});
    });

    it('throws ZarelAuthError when a direct token is missing and a guard code is set', async () => {
        await expect(resolveAuthHeaders('', false, 'runtime_token_missing')).rejects.toBeInstanceOf(ZarelAuthError);
    });
});

// ── Structural check: a single Bearer-building site ─────────────────────────────

function tsFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) out.push(...tsFiles(full));
        else if (entry.endsWith('.ts')) out.push(full);
    }
    return out;
}

describe('single auth authority', () => {
    it('builds a Bearer header in exactly one source file (auth-headers.ts)', () => {
        const srcRoot = join(__dirname, '..', 'src');
        const offenders = tsFiles(srcRoot).filter((f) => /Bearer \$\{|Bearer \$/.test(readFileSync(f, 'utf8')));
        const rel = offenders.map((f) => f.slice(srcRoot.length + 1));
        expect(rel).toEqual(['_internal/auth-headers.ts']);
    });
});
