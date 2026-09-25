// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
import { Zarel } from '../src';
import { Zarel as ZarelFromClient } from '../src/client';
import { ZarelAPIError } from '../src/errors';
import * as Resources from '../src/resources';
import { RecordsResource } from '../src/resources/records';
import type { RecordResponse } from '../src/types';
import type { BulkImportRequest } from '../src/types';

function expectRecordResponseShape(_value: RecordResponse | null): void {
    expect(_value).toBeNull();
}

function expectBulkImportRequestShape(_value: BulkImportRequest | null): void {
    expect(_value).toBeNull();
}

describe('SDK entrypoints', () => {
    it('keeps the root client export aligned with the client subpath', () => {
        expect(Zarel).toBe(ZarelFromClient);
    });

    it('re-exports resource barrels and granular resource modules', () => {
        expect(Resources.RecordsResource).toBe(RecordsResource);
    });

    it('exposes public errors directly', () => {
        const error = new ZarelAPIError(500, 'internal_error', 'INTERNAL_ERROR', 'boom', 'req-1');

        expect(error.name).toBe('ZarelAPIError');
    });

    it('provides a single aggregated types barrel', () => {
        expectRecordResponseShape(null);
        expectBulkImportRequestShape(null);
    });
});
