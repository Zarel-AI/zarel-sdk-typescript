// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// The stream helper is RUNTIME-plane only. It is reachable
// only via `client.runtime.events.stream` and targets the runtime baseUrl; the
// contract namespace exposes no stream surface.
import { Zarel } from '../src/client';

describe('stream helper is runtime-plane only', () => {
    it('exposes client.runtime.events.stream and NOT client.contract.events', () => {
        const client = new Zarel({
            runtimeToken: 'rt',
            contractToken: 'ct',
            runtimeBaseUrl: 'https://acme.example.com/v1',
            contractBaseUrl: 'https://acme.admin.example.com/v1',
        });
        expect(typeof client.runtime.events.stream).toBe('function');
        // The contract `events` surface is config only (rules); it exposes no SSE stream.
        expect((client.contract.events as unknown as { stream?: unknown }).stream).toBeUndefined();
    });

    it('targets the runtime baseUrl (not the contract host)', async () => {
        const fetchFn = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            headers: new Headers(),
            body: new ReadableStream<Uint8Array>({
                start(c) {
                    c.close();
                },
            }),
        } as unknown as Response);
        const client = new Zarel({
            runtimeToken: 'rt',
            contractToken: 'ct',
            runtimeBaseUrl: 'https://acme.example.com/v1',
            contractBaseUrl: 'https://acme.admin.example.com/v1',
            fetch: fetchFn,
        });
        client.runtime.events.stream({}, { reconnect: false });
        await new Promise((r) => setImmediate(r));
        await new Promise((r) => setImmediate(r));
        const url = String(fetchFn.mock.calls[0]![0]);
        expect(url).toBe('https://acme.example.com/v1/runtime/events/stream');
        expect(url).not.toContain('admin');
    });
});
