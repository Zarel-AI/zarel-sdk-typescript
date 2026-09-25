// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
/**
 * SDK parity test for `client.runtime.audit.evidence(log)` and
 * `client.runtime.traces.bundle(id)`, on the client the SDK itself builds.
 *
 * `fetch` is stubbed at the network edge and everything between it and the
 * resource is the SDK's own: a resource built on a fake client can stay green
 * while every real download throws.
 */
import { gzipSync } from 'zlib';
import { Zarel } from '../../src/client';
import { ZarelAPIError, ZarelAuthError } from '../../src/errors';

type MockFetch = jest.Mock<Promise<Response>, [input: string | URL | Request, init?: RequestInit]>;

// A real gzip stream. Its second byte (0x8b) is a UTF-8 continuation byte with no
// lead byte, so a transport that decodes the body as text cannot hand it back intact.
const BUNDLE = new Uint8Array(gzipSync(Buffer.from('zarel-evidence/manifest.json\n')));

function gzipResponse(bytes: Uint8Array = BUNDLE): Response {
    return new Response(bytes, { status: 200, headers: { 'Content-Type': 'application/gzip' } });
}

function errorResponse(status: number, code: string): Response {
    return new Response(
        JSON.stringify({ error: { type: code, code, message: `refused: ${code}`, request_id: 'req-1' } }),
        { status, headers: { 'Content-Type': 'application/json' } },
    );
}

function answering(respond: (input: string | URL | Request) => Response): MockFetch {
    return jest.fn((input: string | URL | Request) => Promise.resolve(respond(input)));
}

function makeZarel(fetchFn: MockFetch, maxRetries = 0): Zarel {
    return new Zarel({
        runtimeToken: 'test-token',
        runtimeBaseUrl: 'https://api.test.com/v1',
        maxRetries,
        retryDelay: 1,
        fetch: fetchFn,
    });
}

function calledUrl(fetchFn: MockFetch, call = 0): URL {
    return new URL(fetchFn.mock.calls[call]![0] as string);
}

function calledHeaders(fetchFn: MockFetch, call = 0): Record<string, string> {
    return fetchFn.mock.calls[call]![1]!.headers as Record<string, string>;
}

const DOWNLOADS: ReadonlyArray<{
    name: string;
    path: string;
    download: (zarel: Zarel) => Promise<ArrayBuffer>;
}> = [
    {
        name: 'audit.evidence',
        path: '/v1/runtime/audit/state_machine/evidence',
        download: (zarel) => zarel.runtime.audit.evidence('state_machine'),
    },
    {
        name: 'traces.bundle',
        path: '/v1/runtime/traces/trc_01/bundle',
        download: (zarel) => zarel.runtime.traces.bundle('trc_01'),
    },
];

describe.each(DOWNLOADS)('$name on the stock FetchClient', ({ path, download }) => {
    test('returns the body byte for byte', async () => {
        const fetchFn = answering(() => gzipResponse());
        const bytes = await download(makeZarel(fetchFn));
        expect(bytes).toBeInstanceOf(ArrayBuffer);
        expect(Buffer.from(bytes).equals(Buffer.from(BUNDLE))).toBe(true);
        expect(calledUrl(fetchFn).pathname).toBe(path);
        expect(fetchFn.mock.calls[0]![1]!.method).toBe('GET');
    });

    test('sends the same headers as a JSON read', async () => {
        const fetchFn = answering((input) => (
            new URL(input as string).pathname === path
                ? gzipResponse()
                : new Response(JSON.stringify({ success: true, data: {} }), { status: 200, headers: { 'Content-Type': 'application/json' } })
        ));
        const zarel = makeZarel(fetchFn);
        await download(zarel);
        await zarel.runtime.traces.get('trc_01');
        const binary = calledHeaders(fetchFn, 0);
        const json = calledHeaders(fetchFn, 1);
        expect(binary['Authorization']).toBe('Bearer test-token');
        expect(Object.keys(binary).sort()).toEqual(Object.keys(json).sort());
        expect({ ...binary, 'X-Request-Id': '' }).toEqual({ ...json, 'X-Request-Id': '' });
    });

    test('maps a non-2xx answer to ZarelAPIError, as a JSON read does', async () => {
        const fetchFn = answering(() => errorResponse(413, 'payload_too_large'));
        const error: unknown = await download(makeZarel(fetchFn)).catch((e: unknown) => e);
        expect(error).toBeInstanceOf(ZarelAPIError);
        expect(error).toMatchObject({ status: 413, code: 'payload_too_large', requestId: 'req-1' });
    });

    test('maps a 401 to ZarelAuthError', async () => {
        const fetchFn = answering(() => errorResponse(401, 'unauthorized'));
        await expect(download(makeZarel(fetchFn))).rejects.toBeInstanceOf(ZarelAuthError);
    });

    test('retries a retryable status, then returns the bytes', async () => {
        const fetchFn: MockFetch = jest.fn()
            .mockResolvedValueOnce(errorResponse(503, 'unavailable'))
            .mockResolvedValueOnce(gzipResponse());
        const bytes = await download(makeZarel(fetchFn, 1));
        expect(fetchFn).toHaveBeenCalledTimes(2);
        expect(Buffer.from(bytes).equals(Buffer.from(BUNDLE))).toBe(true);
    });
});

describe('audit.evidence — range query', () => {
    function evidenceUrl(range?: { from?: number; to?: number }, log: 'flows' | 'state_machine' = 'flows'): Promise<URL> {
        const fetchFn = answering(() => gzipResponse());
        return makeZarel(fetchFn).runtime.audit.evidence(log, range).then(() => calledUrl(fetchFn));
    }

    test('targets the flows log', async () => {
        expect((await evidenceUrl()).pathname).toBe('/v1/runtime/audit/flows/evidence');
    });

    test('appends ?from=&to= when a range is supplied (bounded slice)', async () => {
        expect((await evidenceUrl({ from: 10, to: 20 })).search).toBe('?from=10&to=20');
    });

    test('supports a one-sided range', async () => {
        expect((await evidenceUrl({ from: 100 }, 'state_machine')).search).toBe('?from=100');
    });

    test('omits the query string entirely when the range is empty', async () => {
        expect((await evidenceUrl({})).search).toBe('');
    });
});
