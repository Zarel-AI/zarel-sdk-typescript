// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
/**
 * Locale option for SDK methods that hit
 * locale-aware GET endpoints.
 *
 * When locale is omitted the SDK MUST omit the `?locale=`
 * query param entirely; the server then applies its own resolution chain
 * (JWT preferences.language → canonical). Setting locale to an
 * explicit value sends `?locale=<value>`.
 *
 * The closed enum mirrors the OpenAPI parameter (en | es). Accepts
 * `string` too so callers using a future-locale code (`'fr'`) get a
 * 400 from the server rather than a TS compile error — keeps the SDK
 * surface forward-compatible.
 */

export type SdkLocale = 'en' | 'es' | (string & {});

export interface LocaleOptions {
    /**
     * Optional locale for semantic content (labels, descriptions) in the
     * response. Server falls back to JWT preferences.language → canonical
     * when omitted.
     */
    locale?: SdkLocale;
}
