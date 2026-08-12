# Auth0 MCP OAuth Discovery Extension

This companion Auth0 Custom Extension reserves the `.well-known` Webtask route and serves standard OAuth protected-resource metadata for a separate MCP extension.

It solves the Webtask routing limitation without an external proxy: MCP clients request `/.well-known/oauth-protected-resource/<mcp-path>` and the Webtask proxy routes that request to this extension because its name is `.well-known`.

## Install

1. Publish this repository to GitHub with the generated `index.js` and `build/bundle.js` files committed.
2. Import it into the same Auth0 tenant as a second Custom Extension. Its name must remain `.well-known` and `useHashName` must remain `false`.
3. Configure:
   - `MCP_RESOURCE_URL`: `https://devex.ca.webtask.run/auth0-forms-mcp/mcp`
   - `AUTH0_TENANT_ORIGIN`: `https://devex.ca.auth0.com`
   - `RESOURCE_NAME`: optional display name
4. Connect the MCP client to the main MCP extension URL, not this discovery extension.

For the example above, the client discovers:

```text
https://devex.ca.webtask.run/.well-known/oauth-protected-resource/auth0-forms-mcp/mcp
```

The response advertises the main MCP resource URL and the Auth0 tenant as its authorization server.

## Build

No npm dependencies are required.

```bash
node scripts/validate-manifest.mjs
node scripts/build.mjs
cd dist && zip -q package.zip index.js extension.js package.json
```

The tenant's legacy repository loader fetches `index.js` and `build/bundle.js` from the `master` branch, so commit both generated files.
