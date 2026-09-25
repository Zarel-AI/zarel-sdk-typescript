// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
/**
 * `LlmCredentialsResource`.
 *
 * The credential write body has two arms: an api-key arm (`{ apiKey, baseUrl? }`, sent as
 * `baseURL`) and an AWS arm (`{ accessKeyId, secretAccessKey, region, sessionToken? }`) for
 * Bedrock services. A `put` that built the wire body as `{ apiKey: input.apiKey }` would send an
 * AWS body as `{}` — `JSON.stringify` drops an `undefined` value — and get a 400, so the wire body
 * is asserted for both arms.
 *
 * Mirrors `embedding-credentials-resource.test.ts` deliberately, row for row: both accessors sit
 * over the same credential surface, so a future divergence between the two shows up as a
 * difference between two files that are otherwise the same.
 */

import { LlmCredentialsResource } from '../src/resources/llm-credentials';
import type { FetchClient } from '../src/_internal/fetch-client';

type MockClient = { get: jest.Mock; put: jest.Mock; del: jest.Mock };

function createMockClient(): MockClient {
    return {
        get: jest.fn(() => Promise.resolve({ success: true, data: [] })),
        put: jest.fn(() => Promise.resolve({ success: true, data: {} })),
        del: jest.fn(() => Promise.resolve(undefined)),
    };
}

const resource = (client: MockClient): LlmCredentialsResource =>
    new LlmCredentialsResource(client as unknown as FetchClient);

describe('LlmCredentialsResource', () => {
    it('list → GET /runtime/llm/credentials', async () => {
        const client = createMockClient();
        await resource(client).list();
        expect(client.get).toHaveBeenCalledWith('/runtime/llm/credentials', {}, { operationId: 'listLlmCredentials' });
    });

    it('put apiKey → maps baseUrl to baseURL on the wire', async () => {
        // The one place the two spellings meet: the accessor takes `baseUrl`, the schema declares
        // `baseURL`. Asserted on the BODY rather than the status, because a rename that silently
        // dropped the key would still be a 200 — the field is optional.
        const client = createMockClient();
        await resource(client).put('primary', { apiKey: 'sk', baseUrl: 'https://x' });
        expect(client.put).toHaveBeenCalledWith(
            '/runtime/llm/credentials/primary',
            { apiKey: 'sk', baseURL: 'https://x' },
            { operationId: 'setLlmCredential' },
        );
    });

    it('put apiKey with no override → sends the key alone, and no `baseUrl` residue', async () => {
        // `{...input}` then `delete` is the mechanism; a spread that forgot the delete would send
        // BOTH spellings, and the closed schema answers that with a 400 rather than dropping
        // the key. The assertion is on the exact object for that reason.
        const client = createMockClient();
        await resource(client).put('primary', { apiKey: 'sk' });
        expect(client.put).toHaveBeenCalledWith(
            '/runtime/llm/credentials/primary',
            { apiKey: 'sk' },
            { operationId: 'setLlmCredential' },
        );
    });

    it('put with baseUrl EXPLICITLY undefined → no `baseUrl` key survives into the body', async () => {
        // The case neither of the two rows above covers: the property is PRESENT and undefined,
        // which the spread copies. Against the closed schema that is an unrecognized
        // key; it is invisible today only because `FetchClient` serialises with `JSON.stringify`,
        // which drops undefined values. Asserted on `Object.keys` rather than on equality, because
        // `toEqual` treats an undefined-valued key as absent and would pass either way.
        const client = createMockClient();
        const baseUrl: string | undefined = undefined;
        await resource(client).put('primary', { apiKey: 'sk', baseUrl });
        expect(Object.keys(client.put.mock.calls[0]?.[1] as Record<string, unknown>)).toEqual(['apiKey']);
    });

    it('put the AWS shape → passes it through', async () => {
        // THE ROW THIS FILE EXISTS FOR: without the union and the spread, this call would send `{}`.
        const client = createMockClient();
        const aws = { accessKeyId: 'AKIA', secretAccessKey: 'sk', region: 'us-east-1' };
        await resource(client).put('primary', aws);
        expect(client.put).toHaveBeenCalledWith(
            '/runtime/llm/credentials/primary',
            aws,
            { operationId: 'setLlmCredential' },
        );
    });

    it('put the AWS shape WITH a session token → the optional arm member survives too', async () => {
        const client = createMockClient();
        const aws = { accessKeyId: 'AKIA', secretAccessKey: 'sk', region: 'us-east-1', sessionToken: 'tmp' };
        await resource(client).put('primary', aws);
        expect((client.put.mock.calls[0]?.[1] as Record<string, unknown>)).toEqual(aws);
    });

    it('a service name that needs escaping is encoded, not interpolated raw', async () => {
        const client = createMockClient();
        await resource(client).put('a/b', { apiKey: 'sk' });
        expect(client.put.mock.calls[0]?.[0]).toBe('/runtime/llm/credentials/a%2Fb');
    });
});
