// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
/**
 * `ActionsResource.dispatch()` SDK tests.
 *
 * Covers wire-format serialization and error envelope handling of
 * `POST /runtime/actions/:name`.
 */
import { FetchClient } from '../src/_internal/fetch-client';
import { ActionsResource } from '../src/resources/actions';
import { ZarelAPIError } from '../src/errors';
import { RUNTIME_OPERATIONS } from '../src/generated/unwrap-map';

type MockFetch = jest.Mock<Promise<Response>, [input: string | URL | Request, init?: RequestInit]>;

function mockFetch(status: number, body: unknown, headers?: Record<string, string>): MockFetch {
    return jest.fn<Promise<Response>, [input: string | URL | Request, init?: RequestInit]>().mockResolvedValue({
        ok: status >= 200 && status < 300,
        status,
        statusText: `Status ${status}`,
        json: () => Promise.resolve(body),
        headers: new Headers(headers ?? {}),
    } as Response);
}

function createResource(fetchFn: typeof globalThis.fetch): { actions: ActionsResource; fetchFn: MockFetch } {
    const fc = new FetchClient({
        baseUrl: 'https://acme.example.com/',
        token: 'test-token',
        maxRetries: 0,
        fetch: fetchFn,
        operations: RUNTIME_OPERATIONS,
    });
    return { actions: new ActionsResource(fc), fetchFn: fetchFn as MockFetch };
}

describe('ActionsResource.dispatch', () => {
    it('200: serializes record_id, notes, payload, idempotency_key', async () => {
        const fetchFn = mockFetch(200, { success: true, data: { id: 1 }, resolved_via_action: 'place_order' });
        const { actions } = createResource(fetchFn);

        const result = await actions.dispatch('place_order', {
            record_id: 7,
            notes: 'cx asked',
            payload: { quantity: 3 },
            idempotency_key: 'k-123',
        });

        const [url, init] = (fetchFn as MockFetch).mock.calls[0] as [string, RequestInit];
        expect(url).toContain('/runtime/actions/place_order');
        expect(init.method).toBe('POST');
        const body = JSON.parse(init.body as string);
        expect(body).toEqual({
            record_id: 7,
            notes: 'cx asked',
            payload: { quantity: 3 },
            idempotency_key: 'k-123',
        });
        expect(result.success).toBe(true);
        expect(result.resolved_via_action).toBe('place_order');
        expect(result.data).toEqual({ id: 1 });
    });

    it('200: empty params → empty body object', async () => {
        const fetchFn = mockFetch(200, { success: true, data: { id: 1 }, resolved_via_action: 'snapshot' });
        const { actions } = createResource(fetchFn);

        await actions.dispatch('snapshot');

        const [, init] = (fetchFn as MockFetch).mock.calls[0] as [string, RequestInit];
        const body = JSON.parse(init.body as string);
        expect(body).toEqual({});
    });

    it('200: omits unset fields from body (record_id undefined)', async () => {
        const fetchFn = mockFetch(200, { success: true, data: null, resolved_via_action: 'bulk_close' });
        const { actions } = createResource(fetchFn);

        await actions.dispatch('bulk_close', { notes: 'eod' });

        const [, init] = (fetchFn as MockFetch).mock.calls[0] as [string, RequestInit];
        const body = JSON.parse(init.body as string);
        expect(body).toEqual({ notes: 'eod' });
        expect('record_id' in body).toBe(false);
    });

    it('200: record_id can be string id', async () => {
        const fetchFn = mockFetch(200, { success: true, data: { id: 'abc' }, resolved_via_action: 'foo' });
        const { actions } = createResource(fetchFn);

        await actions.dispatch('foo', { record_id: 'abc' });

        const [, init] = (fetchFn as MockFetch).mock.calls[0] as [string, RequestInit];
        const body = JSON.parse(init.body as string);
        expect(body.record_id).toBe('abc');
    });

    it('200: record_id can be null (entity-level)', async () => {
        const fetchFn = mockFetch(200, { success: true, data: null, resolved_via_action: 'foo' });
        const { actions } = createResource(fetchFn);

        await actions.dispatch('foo', { record_id: null });

        const [, init] = (fetchFn as MockFetch).mock.calls[0] as [string, RequestInit];
        const body = JSON.parse(init.body as string);
        expect(body.record_id).toBe(null);
    });

    it('action name is URL-encoded', async () => {
        const fetchFn = mockFetch(200, { success: true, data: null, resolved_via_action: 'a/b' });
        const { actions } = createResource(fetchFn);

        await actions.dispatch('a/b');

        const [url] = (fetchFn as MockFetch).mock.calls[0] as [string, RequestInit];
        expect(url).toContain('/runtime/actions/a%2Fb');
    });

    it('404: throws ZarelAPIError with code=unknown_action', async () => {
        const fetchFn = mockFetch(404, {
            error: { type: 'not_found', code: 'unknown_action', message: 'Unknown action: nope', request_id: 'r-1' },
        });
        const { actions } = createResource(fetchFn);

        await expect(actions.dispatch('nope')).rejects.toBeInstanceOf(ZarelAPIError);
        try {
            await actions.dispatch('nope');
        } catch (err) {
            expect((err as ZarelAPIError).status).toBe(404);
            expect((err as ZarelAPIError).code).toBe('unknown_action');
        }
    });

    it('403: throws ZarelAPIError with code=action_unauthorized', async () => {
        const fetchFn = mockFetch(403, {
            error: { type: 'authorization_error', code: 'action_unauthorized', message: 'forbidden', request_id: 'r-1' },
        });
        const { actions } = createResource(fetchFn);

        try {
            await actions.dispatch('cancel_booking', { record_id: 5 });
            fail('expected throw');
        } catch (err) {
            expect((err as ZarelAPIError).status).toBe(403);
            expect((err as ZarelAPIError).code).toBe('action_unauthorized');
        }
    });

    it('400: surfaces error.field via ZarelAPIError.field (wire-format extension)', async () => {
        const fetchFn = mockFetch(400, {
            error: {
                type: 'invalid_request',
                code: 'validation_error',
                message: 'quantity must be positive',
                request_id: 'r-1',
                field: 'quantity',
            },
        });
        const { actions } = createResource(fetchFn);

        try {
            await actions.dispatch('place_order', { payload: { quantity: -5 } });
            fail('expected throw');
        } catch (err) {
            expect((err as ZarelAPIError).status).toBe(400);
            expect((err as ZarelAPIError).code).toBe('validation_error');
            expect((err as ZarelAPIError).field).toBe('quantity');
        }
    });
});
