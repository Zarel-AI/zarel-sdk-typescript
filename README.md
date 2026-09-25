# zarel-sdk-typescript

The TypeScript SDK for the [Zarel](https://zarel.ai) API.

| package | what it is |
|---|---|
| [`@zarel-ai/sdk`](packages/sdk) | One `Zarel` client with two namespaces: `client.runtime.*` (records, tools, conversation, flows, traces, …) and `client.contract.*` (the contract: entities, roles, authorization, …). Zero runtime dependencies: native `fetch`, Node 18+ and browsers. |

The package's README shows how to use it.

## Building and testing

```bash
cd packages/sdk
npm install
npm test
npm run build
```

The request and response types in `packages/sdk/src/generated/` are generated from the Zarel API's
OpenAPI documents and are not edited by hand. A change to them arrives with a release of this
repository.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Every commit needs a `Signed-off-by:` line, under the
[Developer Certificate of Origin](DCO).

## License

MIT © 2026 Nicolas Moreno. See [LICENSE](LICENSE).

<!-- DCO probe, not for merge -->
