# Auth0 MCP OAuth Discovery Extension

This companion Auth0 Custom Extension reserves the `.well-known` Webtask route and serves standard OAuth discovery metadata for any number of MCP extensions installed in the same tenant. It requires **no configuration** — install it once per tenant and it's done.

It solves the Webtask routing limitation without an external proxy: `.well-known`-prefixed requests only ever reach an extension whose own name is `.well-known`, so any MCP client asking for `/.well-known/...` on the tenant's Webtask domain lands here automatically.

## Routes

- `GET /.well-known/oauth-protected-resource/<mcp-extension-name>/mcp` — RFC 9728 protected-resource metadata for the MCP extension at that path. The extension name and path are read directly from the request; nothing needs to be configured per MCP extension. Returns `resource` (the reconstructed MCP endpoint URL) and `authorization_servers` (this tenant's issuer).
- `GET /.well-known/oauth-authorization-server` — RFC 8414 authorization-server metadata for the tenant. Proxies the tenant's own `https://<tenant>/.well-known/openid-configuration` (derived from `AUTH0_DOMAIN`, which Webtask injects automatically) so it always reflects Auth0's actual, current endpoints rather than a hand-maintained copy.
- `GET /.well-known/oauth-protected-resource` (no suffix) is **not** served (404) — there is no way to tell which MCP extension a bare request means without per-extension configuration, and any MCP client that correctly follows OAuth discovery (401 → `WWW-Authenticate` → fetch the metadata URL from that header) always receives the resource-suffixed URL directly and never needs the bare path.

## Install

1. Publish this repository to GitHub with the generated `index.js` and `build/bundle.js` files committed.
2. Import it into the same Auth0 tenant as your MCP extension(s), as a second Custom Extension. Its name must remain `.well-known` and `useHashName` must remain `false`.
3. That's it — no settings to configure. It serves metadata for any MCP extension in the tenant automatically, based on whatever resource-suffixed path a client requests.
4. Connect an MCP client to the MCP extension's own URL (e.g. `https://<tenant>.webtask.run/<mcp-extension-name>/mcp`), not to this discovery extension directly. The MCP extension's own `WWW-Authenticate` challenge tells clients where to find this extension's metadata.

## Build

```bash
npm install
npm test
```

`npm test` runs manifest validation, the build, and an offline smoke test (the `oauth-authorization-server` check mocks `fetch` rather than making a live network call, so `npm test` never depends on network access or a real tenant).

The tenant's legacy repository loader fetches `index.js` and `build/bundle.js` from the `master` branch, so commit both generated files, and keep `main`/`master` in sync (`git checkout master && git merge --ff-only origin/main && git push origin master` after merging to `main`).
