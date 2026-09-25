// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// Pure parser for the HTTP `Retry-After` response header (RFC 7231 §7.1.3).
// Two forms are accepted: an integer count of seconds (delta-seconds) and an
// HTTP-date. Returns a NON-NEGATIVE millisecond delay, or `undefined` when the
// header is absent/unparseable. The caller injects `nowMs` (so the HTTP-date
// arithmetic is deterministic and testable) and is responsible for clamping the
// result to a ceiling — this module is parsing only, no policy.
//
// No `as` cast, no schema library — hand-written narrowing (the SDK's zero-dep,
// no-Zod boundary convention).
export function parseRetryAfter(value: string | null, nowMs: number): number | undefined {
    if (value === null) return undefined;
    const trimmed = value.trim();
    if (trimmed === '') return undefined;

    // delta-seconds: an integer number of seconds (RFC 7231 requires an integer).
    if (/^-?\d+$/.test(trimmed)) {
        const seconds = Number(trimmed);
        return Math.max(0, seconds * 1000);
    }

    // HTTP-date: must contain letters (month/day names + "GMT") — this rejects
    // bare numerics like "1.5"/"1e3" that `Date.parse` would otherwise coerce
    // into a year. A real HTTP-date → delta from now, floored at 0.
    if (!/[a-zA-Z]/.test(trimmed)) return undefined;
    const parsed = Date.parse(trimmed);
    if (Number.isNaN(parsed)) return undefined;
    return Math.max(0, parsed - nowMs);
}
