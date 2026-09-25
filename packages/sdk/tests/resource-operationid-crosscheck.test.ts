// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// Cross-check (resources → map): every `operationId: '…'` literal a
// resource passes to the transport is a real key of the generated unwrap map.
// This catches typos and renames in CI, so the transport's runtime fail-fast
// (an unmapped operationId throwing ZarelError) effectively never fires in prod.
//
// Membership is checked against the UNION of both plane maps: per-plane routing
// is enforced separately (client.ts injects RUNTIME_OPERATIONS into the runtime
// client and CONTRACT_OPERATIONS into the contract client; a wrong-plane id then
// fails fast at runtime and is covered by plane-routing.regression.test.ts).
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { RUNTIME_OPERATIONS, CONTRACT_OPERATIONS } from '../src/generated/unwrap-map';

const SRC = join(__dirname, '..', 'src');
const SURFACE_DIRS = [join(SRC, 'resources'), join(SRC, 'contract'), join(SRC, 'runtime')];

function walk(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) out.push(...walk(full));
        else if (entry.endsWith('.ts')) out.push(full);
    }
    return out;
}

const KNOWN = new Set<string>([
    ...Object.keys(RUNTIME_OPERATIONS),
    ...Object.keys(CONTRACT_OPERATIONS),
]);

describe('resource operationId cross-check', () => {
    it('every operationId literal in the resource surface is a key of the unwrap map', () => {
        const offenders: Array<{ file: string; operationId: string }> = [];
        for (const dir of SURFACE_DIRS) {
            for (const file of walk(dir)) {
                const src = readFileSync(file, 'utf8');
                for (const m of src.matchAll(/operationId:\s*'([^']+)'/g)) {
                    const id = m[1];
                    if (!KNOWN.has(id)) offenders.push({ file: file.replace(SRC, 'src'), operationId: id });
                }
            }
        }
        expect(offenders).toEqual([]);
    });
});
