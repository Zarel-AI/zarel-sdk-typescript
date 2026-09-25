// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
/**
 * The operationId suffix for an on-path — mirrors the OpenAPI generator exactly.
 *
 * The operationId is the SINGLE unwrap authority, so every call
 * must name its operation. The SDK carries zero runtime dependencies, so it
 * cannot import the canonical derivation from `@zarel-ai/contract`; it mirrors
 * it here instead, and `authorization-operation-ids.test.ts` asserts every
 * derived id exists in the GENERATED unwrap map, so the mirror cannot drift
 * silently.
 *
 * Dynamic families are SINGULAR (`OnFlow`, not `OnFlows`) because the config
 * section `flows` and the per-flow grant `flows/{name}` would otherwise collide.
 */
export function authorizationOperationSuffix(onPath: string): string {
    if (onPath.startsWith('records/')) return 'OnRecord';
    if (onPath.startsWith('flows/')) return 'OnFlow';
    if (onPath.startsWith('llm/services/')) return 'OnLlmService';
    const pascal = onPath
        .split(/[^a-zA-Z0-9]+/)
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join('');
    return `On${pascal}`;
}
