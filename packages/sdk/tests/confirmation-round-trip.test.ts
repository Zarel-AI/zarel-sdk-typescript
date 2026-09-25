// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
/**
 * The client half of the confirmation round-trip.
 *
 * Two things must hold or no client can ever satisfy a `confirm` guard:
 *   1. the 409's `error.confirmation` survives into `ZarelAPIError` — it rides
 *      INSIDE the `error` envelope, which `details` deliberately excludes — with
 *      EVERY guard that fired, because the token is bound to the whole set;
 *   2. the retry carries the token in `X-Zarel-Confirmation-Token`.
 */
import { FetchClient } from '../src/_internal/fetch-client';
import { parseConfirmationChallenge } from '../src/_internal/confirmation';
import { ActionsResource } from '../src/resources/actions';
import { RecordsResource } from '../src/resources/records';
import { ZarelAPIError } from '../src/errors';
import { RUNTIME_OPERATIONS } from '../src/generated/unwrap-map';

type MockFetch = jest.Mock<Promise<Response>, [input: string | URL | Request, init?: RequestInit]>;

const TOKEN = 'zct1.MTc1MzYyNA.c2lnbmF0dXJl';

function mockFetch(status: number, body: unknown): MockFetch {
    return jest.fn<Promise<Response>, [input: string | URL | Request, init?: RequestInit]>().mockResolvedValue({
        ok: status >= 200 && status < 300,
        status,
        statusText: `Status ${status}`,
        json: () => Promise.resolve(body),
        headers: new Headers({ 'content-type': 'application/json' }),
    } as Response);
}

function createResources(fetchFn: MockFetch): { actions: ActionsResource; records: RecordsResource } {
    const fc = new FetchClient({
        baseUrl: 'https://acme.example.com/',
        token: 'test-token',
        maxRetries: 0,
        fetch: fetchFn as unknown as typeof globalThis.fetch,
        operations: RUNTIME_OPERATIONS,
    });
    return { actions: new ActionsResource(fc), records: new RecordsResource(fc) };
}

function challengeBody(guards: Array<{ name: string; prompt: string }>): unknown {
    return {
        error: {
            type: 'conflict',
            code: 'confirmation_required',
            message: 'confirmation required',
            request_id: 'req-1',
            confirmation: { guards, token: TOKEN, expires_at: '2026-07-27T12:05:00.000Z' },
        },
    };
}

function sentHeaders(fetchFn: MockFetch): Record<string, string> {
    return (fetchFn.mock.calls[0]![1] as RequestInit).headers as Record<string, string>;
}

describe('409 confirmation_required → ZarelAPIError.confirmation', () => {
    it('surfaces EVERY guard that fired, plus the token', async () => {
        const fetchFn = mockFetch(409, challengeBody([
            { name: 'confirm_over_approval', prompt: 'Amount is over the approval ceiling. Proceed?' },
            { name: 'status__pending__approved', prompt: 'This approves the claim. Proceed?' },
        ]));
        const { actions } = createResources(fetchFn);

        const err: unknown = await actions.dispatch('approve_claim', { record_id: 7 })
            .then(() => undefined, (e: unknown) => e);

        expect(err).toBeInstanceOf(ZarelAPIError);
        const apiError = err as ZarelAPIError;
        expect(apiError.status).toBe(409);
        expect(apiError.code).toBe('confirmation_required');
        expect(apiError.confirmation?.token).toBe(TOKEN);
        expect(apiError.confirmation?.expires_at).toBe('2026-07-27T12:05:00.000Z');
        expect(apiError.confirmation?.guards).toEqual([
            { name: 'confirm_over_approval', prompt: 'Amount is over the approval ceiling. Proceed?' },
            { name: 'status__pending__approved', prompt: 'This approves the claim. Proceed?' },
        ]);
    });

    it('leaves `confirmation` undefined on an ordinary error', async () => {
        const fetchFn = mockFetch(403, {
            error: { type: 'authorization_error', code: 'action_unauthorized', message: 'nope', request_id: 'r' },
        });
        const { actions } = createResources(fetchFn);

        const err = await actions.dispatch('approve_claim').then(() => undefined, (e: unknown) => e);
        expect((err as ZarelAPIError).confirmation).toBeUndefined();
    });
});

describe('the confirming retry', () => {
    it('sends the token in X-Zarel-Confirmation-Token, with a byte-identical body', async () => {
        const fetchFn = mockFetch(200, { success: true, data: { id: 7 }, resolved_via_action: 'approve_claim' });
        const { actions } = createResources(fetchFn);

        await actions.dispatch('approve_claim', { record_id: 7 }, { confirmationToken: TOKEN });

        expect(sentHeaders(fetchFn)['X-Zarel-Confirmation-Token']).toBe(TOKEN);
        // The digest binds the payload AS REQUESTED: an edited retry is a
        // different write and is challenged again by design.
        expect((fetchFn.mock.calls[0]![1] as RequestInit).body).toBe(JSON.stringify({ record_id: 7 }));
    });

    it.each([
        ['create', (r: RecordsResource): Promise<unknown> => r.create('claims', { amount: 1 }, { confirmationToken: TOKEN })],
        ['update', (r: RecordsResource): Promise<unknown> => r.update('claims', 7, { amount: 1 }, { confirmationToken: TOKEN })],
        ['delete', (r: RecordsResource): Promise<unknown> => r.delete('claims', 7, { confirmationToken: TOKEN })],
    ])('sends the token on records.%s — every write the OpenAPI declares the header on', async (_label, call) => {
        const fetchFn = mockFetch(200, { success: true, data: {} });
        const { records } = createResources(fetchFn);

        await call(records);

        expect(sentHeaders(fetchFn)['X-Zarel-Confirmation-Token']).toBe(TOKEN);
    });

    it('omits the header entirely when no token is supplied', async () => {
        const fetchFn = mockFetch(200, { success: true, data: null, resolved_via_action: 'approve_claim' });
        const { actions } = createResources(fetchFn);

        await actions.dispatch('approve_claim');

        expect(sentHeaders(fetchFn)).not.toHaveProperty('X-Zarel-Confirmation-Token');
    });
});

describe('parseConfirmationChallenge fails closed', () => {
    // A challenge the client cannot act on must NOT reach the caller as a
    // confirmable error: it would render a Confirm button that can only fail.
    it.each([
        ['no token', { guards: [{ name: 'g', prompt: 'p' }], expires_at: 'x' }],
        ['an empty token', { guards: [{ name: 'g', prompt: 'p' }], token: '', expires_at: 'x' }],
        ['no guards', { guards: [], token: TOKEN, expires_at: 'x' }],
        ['guards that are not an array', { guards: 'g', token: TOKEN, expires_at: 'x' }],
        ['every guard nameless', { guards: [{ prompt: 'p' }], token: TOKEN, expires_at: 'x' }],
        ['a non-object', 'nope'],
        ['nothing at all', undefined],
    ])('drops a challenge with %s', (_label, raw) => {
        expect(parseConfirmationChallenge(raw)).toBeUndefined();
    });

    it('keeps a named guard whose prompt is missing, and drops only the nameless one', () => {
        const parsed = parseConfirmationChallenge({
            guards: [{ prompt: 'orphan' }, { name: 'confirm_delete' }],
            token: TOKEN,
            expires_at: 'x',
        });
        // A nameless guard cannot be matched or audited; a prompt-less one is
        // still shown, because the name is what makes it auditable.
        expect(parsed?.guards).toEqual([{ name: 'confirm_delete', prompt: 'Confirm "confirm_delete"' }]);
    });
});
