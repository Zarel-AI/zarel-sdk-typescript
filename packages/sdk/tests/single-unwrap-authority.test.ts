// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// The envelope unwrap is performed in EXACTLY one place: the
// transport (`_internal/fetch-client.ts`). No resource/namespace file may
// unwrap `{success,data}` itself (i.e. re-extract `.data` off a transport
// result) or re-implement the envelope guard.
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const SRC = join(__dirname, '..', 'src');

function walk(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) out.push(...walk(full));
        else if (entry.endsWith('.ts')) out.push(full);
    }
    return out;
}

describe('single envelope-unwrap authority', () => {
    const allFiles = walk(SRC);
    const transport = join(SRC, '_internal', 'fetch-client.ts');

    it('the unwrap helper + envelope guard live ONLY in the transport', () => {
        for (const file of allFiles) {
            if (file === transport) continue;
            const src = readFileSync(file, 'utf8');
            expect(src).not.toMatch(/\bunwrapEnvelope\b/);
            expect(src).not.toMatch(/\bisSuccessEnvelope\b/);
        }
    });

    it('the legacy keys-heuristic is gone everywhere (clean cut)', () => {
        for (const file of allFiles) {
            const src = readFileSync(file, 'utf8');
            expect(src).not.toMatch(/\bisCanonicalEnvelope\b/);
            expect(src).not.toMatch(/\bENVELOPE_KEYS\b/);
        }
    });

    it('no resource/namespace passes a literal `unwrap:` to the transport (the map decides)', () => {
        const surface = allFiles.filter(
            (f) => f.includes(`${join('src', 'resources')}`) ||
                f.includes(`${join('src', 'contract')}`) ||
                f.includes(`${join('src', 'runtime')}`),
        );
        for (const file of surface) {
            const src = readFileSync(file, 'utf8');
            expect(src).not.toMatch(/\bunwrap:\s*(true|false)\b/);
        }
    });

    it('no resource/namespace file re-extracts `.data` off a transport result', () => {
        // `).data` is the tell-tale of `(await this.client.get(...)).data` — an
        // out-of-transport unwrap. Snapshot reads bare-body fields via a local
        // (`data.contract_version`, i.e. `data.` not `).data`) and is exempt.
        const surface = allFiles.filter(
            (f) => f.includes(`${join('src', 'resources')}`) ||
                f.includes(`${join('src', 'contract')}`) ||
                f.includes(`${join('src', 'runtime')}`),
        );
        for (const file of surface) {
            const src = readFileSync(file, 'utf8');
            expect(src).not.toMatch(/\)\s*\.\s*data\b/);
        }
    });
});
