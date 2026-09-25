// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// Pure SSE frame parser. Byte-split feeding exercises the
// partial-frame carry path.
import { parseSseFrames, type RawSseFrame } from '../src/_internal/sse-client';

/** Feed `text` to the parser in `n`-char slices and collect all frames. */
function parseInChunks(text: string, sliceLen: number): RawSseFrame[] {
    const frames: RawSseFrame[] = [];
    let carry = '';
    for (let i = 0; i < text.length; i += sliceLen) {
        const res = parseSseFrames(text.slice(i, i + sliceLen), carry);
        carry = res.carry;
        frames.push(...res.frames);
    }
    return frames;
}

describe('parseSseFrames', () => {
    it('parses a single named event frame', () => {
        const { frames, carry } = parseSseFrames('event: conversation.turn_created\ndata: {"a":1}\n\n', '');
        expect(carry).toBe('');
        expect(frames).toEqual([{ event: 'conversation.turn_created', data: '{"a":1}' }]);
    });

    it('joins multi-line data with \\n', () => {
        const { frames } = parseSseFrames('data: line1\ndata: line2\n\n', '');
        expect(frames).toHaveLength(1);
        expect(frames[0]!.data).toBe('line1\nline2');
    });

    it('captures id and retry', () => {
        const { frames } = parseSseFrames('id: 42\nretry: 2500\nevent: x\ndata: {}\n\n', '');
        expect(frames[0]).toEqual({ event: 'x', data: '{}', id: '42', retry: 2500 });
    });

    it('ignores comment lines (:heartbeat, :ok)', () => {
        const { frames } = parseSseFrames(':ok\n\n:heartbeat\n\nevent: x\ndata: 1\n\n', '');
        expect(frames).toEqual([{ event: 'x', data: '1' }]);
    });

    it('carries an incomplete frame across chunks', () => {
        const first = parseSseFrames('event: x\nda', '');
        expect(first.frames).toHaveLength(0);
        const second = parseSseFrames('ta: {"v":7}\n\n', first.carry);
        expect(second.frames).toEqual([{ event: 'x', data: '{"v":7}' }]);
    });

    it('reassembles a frame split byte-by-byte', () => {
        const wire = 'event: conversation.turn_created\ndata: {"hello":"world"}\n\n';
        const frames = parseInChunks(wire, 1);
        expect(frames).toEqual([{ event: 'conversation.turn_created', data: '{"hello":"world"}' }]);
    });

    it('parses two frames in one chunk', () => {
        const { frames } = parseSseFrames('event: a\ndata: 1\n\nevent: b\ndata: 2\n\n', '');
        expect(frames.map((f) => f.event)).toEqual(['a', 'b']);
    });

    it('strips a single leading space after the colon (and only one)', () => {
        const { frames } = parseSseFrames('data:  two-spaces\n\n', '');
        expect(frames[0]!.data).toBe(' two-spaces');
    });

    it('tolerates \\r\\n line endings', () => {
        const { frames } = parseSseFrames('event: x\r\ndata: 1\r\n\r\n', '');
        expect(frames).toEqual([{ event: 'x', data: '1' }]);
    });
});
