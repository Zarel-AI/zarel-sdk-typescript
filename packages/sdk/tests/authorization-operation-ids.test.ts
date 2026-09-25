// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
/**
 * The SDK's authorization operationIds must exist in the GENERATED unwrap map.
 *
 * The operationId is the single unwrap authority, and the
 * transport fails fast on an unmapped one — so a wrong id is not a cosmetic slip,
 * it breaks the call at runtime. The SDK carries zero runtime dependencies, so
 * it cannot import the canonical suffix derivation from `@zarel-ai/contract`; it
 * mirrors it locally. This suite is what stops that mirror drifting: it derives
 * every id the resource can emit and asserts the generated map contains it.
 */

import { CONTRACT_OPERATIONS } from '../src/generated/unwrap-map';
import { authorizationOperationSuffix } from '../src/resources/authorization-operation-ids';

/** The canonical on-path vocabulary, mirrored (same zero-dep reason as above). */
const CONFIG_SECTIONS = [
    'metadata', 'entities', 'roles', 'skills', 'actions', 'schemas',
    'capabilities', 'flows', 'constraints', 'events',
    'process_model', 'authorization',
    // Contract root sections.
    'llm', 'embeddings', 'treatment', 'channels', 'channels/credentials',
    'mcp_servers', 'quotas', 'timezone',
    'channels', 'channels/credentials',
] as const;

const OPERATIONAL_SAMPLES = [
    'records/orders',
    'flows/intake',
    'llm/services/primary',
] as const;

const contractOps: Record<string, unknown> = CONTRACT_OPERATIONS;

describe('authorization operationIds resolve against the generated unwrap map', () => {
    it('the collection operations are mapped', () => {
        expect(Object.keys(contractOps)).toContain('listRoleGrants');
        expect(Object.keys(contractOps)).toContain('createRoleGrant');
    });

    it.each([...CONFIG_SECTIONS, ...OPERATIONAL_SAMPLES])('every verb on %s is mapped', (onPath) => {
        const suffix = authorizationOperationSuffix(onPath);
        for (const verb of ['get', 'put', 'patch', 'delete']) {
            const operationId = `${verb}Grant${suffix}`;
            expect({ onPath, operationId, mapped: Object.prototype.hasOwnProperty.call(contractOps, operationId) })
                .toEqual({ onPath, operationId, mapped: true });
        }
    });

    it('dynamic families are SINGULAR so they cannot collide with a config section', () => {
        // `flows` (the section) and `flows/{name}` (one flow) both pascal-case to
        // "Flows"; that collision produced duplicate operationIds and a TS2300
        // in the generated types. Singular ids are the fix, pinned here.
        expect(authorizationOperationSuffix('flows')).toBe('OnFlows');
        expect(authorizationOperationSuffix('flows/intake')).toBe('OnFlow');
        expect(authorizationOperationSuffix('records/orders')).toBe('OnRecord');
        expect(authorizationOperationSuffix('llm/services/primary')).toBe('OnLlmService');
    });

    it('nested config sections keep every segment', () => {
        expect(authorizationOperationSuffix('channels')).toBe('OnChannels');
        expect(authorizationOperationSuffix('channels/credentials')).toBe('OnChannelsCredentials');
        expect(authorizationOperationSuffix('process_model')).toBe('OnProcessModel');
    });
});
