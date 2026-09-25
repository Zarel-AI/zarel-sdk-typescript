// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// No typed-cohort resource method declares `Promise<unknown>`
// or a `{ success, data }` envelope return. Guards against re-drift on the
// typed surface (the cohort + the contract flows/skills/actions surface +
// the runtime data-plane resources listed below).
// `runtime.mcp.call` is exempt (bare JSON-RPC via the dedicated postMcp path —
// never the {success,data} envelope).
import { readFileSync } from 'fs';
import { join } from 'path';

const SRC = join(__dirname, '..', 'src');

const TYPED_SURFACE = [
    'resources/entities.ts',
    'resources/roles.ts',
    'resources/role-assignments.ts',
    'resources/authorization.ts',
    'resources/authorization-ceiling.ts',
    'contract/flows.ts',
    'contract/skills.ts',
    'contract/actions.ts',
    // Contract sections + the contract root resources (no admin/ level).
    'contract/capabilities.ts',
    'contract/constraints.ts',
    'contract/schemas.ts',
    'contract/metadata.ts',
    'contract/events.ts',
    'contract/process-model.ts',
    'contract/_singleton.ts',
    'contract/roots/mcp-servers.ts',
    'contract/roots/timezone.ts',
    'contract/roots/profiles.ts',
    'contract/roots/channels.ts',
    'contract/roots/vocabulary.ts',
    'contract/roots/treatment.ts',
    'contract/roots/events.ts',
    // Runtime data-plane (canonical envelopes unwrapped at the
    // transport + their named response types in types/*.ts).
    'resources/records.ts',
    'resources/conversation-sessions.ts',
    'resources/state-machine.ts',
    'resources/events.ts',
];

describe('no envelope/unknown in the typed cohort surface', () => {
    it.each(TYPED_SURFACE)('%s declares no Promise<unknown>', (rel) => {
        const src = readFileSync(join(SRC, rel), 'utf8');
        expect(src).not.toMatch(/Promise<unknown>/);
    });

    it.each(TYPED_SURFACE)('%s exposes no { success, data } envelope return', (rel) => {
        const src = readFileSync(join(SRC, rel), 'utf8');
        expect(src).not.toMatch(/\{\s*success:\s*boolean;\s*data:/);
        expect(src).not.toMatch(/Promise<\{ success/);
    });
});
