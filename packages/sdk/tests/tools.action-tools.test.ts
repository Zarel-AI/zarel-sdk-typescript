// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
/**
 * `UserToolCatalog.actions[]` SDK type surface tests.
 *
 * Pure type-level + structural assertions; no HTTP. Verifies that:
 *   1. The new `actions?` field is optional on the type (additive non-breaking)
 *   2. `UserVisibleActionTool` shape is reachable from the SDK public surface
 *   3. Catalogs without the field still satisfy the type
 */
import type { UserToolCatalog, UserVisibleActionTool } from '../src';

describe('UserToolCatalog.actions (SDK type surface)', () => {
    it('actions is optional — catalogs without it still satisfy the type', () => {
        const catalog: UserToolCatalog = {
            tenant_name: 't',
            user_name: 'u',
            user_roles: [],
            entities: [],
            roles: [],
            flows: [],
            skills: [],
            admin_sections: [],
            // No actions — must compile.
        };
        expect(catalog.actions).toBeUndefined();
    });

    it('actions[] entries carry the documented shape', () => {
        const tool: UserVisibleActionTool = {
            name: 'cancel_booking',
            entity: 'bookings',
            verb: 'update',
            description: 'Cancel a booking',
            intent_type: 'action.cancel_booking',
            provenance: 'native',
        };
        const catalog: UserToolCatalog = {
            tenant_name: 't',
            user_name: 'u',
            user_roles: [],
            entities: [],
            roles: [],
            flows: [],
            skills: [],
            admin_sections: [],
            actions: [tool],
        };
        expect(catalog.actions).toHaveLength(1);
        expect(catalog.actions![0].name).toBe('cancel_booking');
        expect(catalog.actions![0].provenance).toBe('native');
    });

    it('external provenance is allowed via the discriminated literal', () => {
        const tool: UserVisibleActionTool = {
            name: 'stripe.refund',
            entity: 'orders',
            verb: 'update',
            intent_type: 'external.stripe.refund',
            provenance: 'external',
        };
        expect(tool.provenance).toBe('external');
    });
});
