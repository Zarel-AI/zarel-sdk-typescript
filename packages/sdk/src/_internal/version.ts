// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// The SDK's self-identifying version. Hand-maintained and kept in sync with
// `package.json` by a drift-guard test —
// a runtime `import` of package.json is avoided so nothing third-party / JSON
// enters the runtime graph (zero-runtime-deps invariant).
export const SDK_VERSION = '0.7.0';

/** Sent as the `User-Agent` header on every request (Node-effective; browsers
 *  drop it — `User-Agent` is a forbidden header name in `fetch`). */
export const USER_AGENT = `@zarel-ai/sdk/${SDK_VERSION}`;
