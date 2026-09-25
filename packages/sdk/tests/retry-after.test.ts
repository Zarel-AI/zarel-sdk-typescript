// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// The pure Retry-After parser. Covers both RFC 7231 forms
// (delta-seconds + HTTP-date), the 0-floor for past/negative, and undefined for
// absent/unparseable. `nowMs` is injected so the HTTP-date arithmetic is
// deterministic (no reliance on the wall clock).
import { parseRetryAfter } from '../src/_internal/retry-after';

const NOW = 1_000_000; // arbitrary fixed "now" in ms

describe('parseRetryAfter', () => {
    describe('delta-seconds form', () => {
        it('parses an integer number of seconds into milliseconds', () => {
            expect(parseRetryAfter('2', NOW)).toBe(2000);
            expect(parseRetryAfter('120', NOW)).toBe(120_000);
        });

        it('parses 0 seconds as 0 ms (retry immediately)', () => {
            expect(parseRetryAfter('0', NOW)).toBe(0);
        });

        it('floors a negative delta-seconds value to 0', () => {
            expect(parseRetryAfter('-5', NOW)).toBe(0);
        });

        it('tolerates surrounding whitespace', () => {
            expect(parseRetryAfter('  3  ', NOW)).toBe(3000);
        });

        it('returns undefined for a non-integer numeric (not a valid delta-seconds)', () => {
            // RFC 7231 delta-seconds is an integer; "1.5" is neither a valid
            // delta-seconds nor an HTTP-date → unparseable.
            expect(parseRetryAfter('1.5', NOW)).toBeUndefined();
        });
    });

    describe('HTTP-date form', () => {
        it('parses a future HTTP-date into the delta from now', () => {
            const future = new Date(NOW + 5000).toUTCString(); // truncates to whole seconds
            expect(parseRetryAfter(future, NOW)).toBe(5000);
        });

        it('floors a past HTTP-date to 0', () => {
            const past = new Date(NOW - 10_000).toUTCString();
            expect(parseRetryAfter(past, NOW)).toBe(0);
        });
    });

    describe('absent / unparseable', () => {
        it('returns undefined for null', () => {
            expect(parseRetryAfter(null, NOW)).toBeUndefined();
        });

        it('returns undefined for an empty string', () => {
            expect(parseRetryAfter('', NOW)).toBeUndefined();
            expect(parseRetryAfter('   ', NOW)).toBeUndefined();
        });

        it('returns undefined for garbage', () => {
            expect(parseRetryAfter('soon', NOW)).toBeUndefined();
            expect(parseRetryAfter('not-a-date', NOW)).toBeUndefined();
        });
    });
});
