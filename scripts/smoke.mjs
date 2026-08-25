import { createRequire } from "node:module";
import http from "node:http";

const require = createRequire(import.meta.url);

const mockOidcConfig = {
  issuer: "https://tenant.us.auth0.com/",
  authorization_endpoint: "https://tenant.us.auth0.com/authorize",
  token_endpoint: "https://tenant.us.auth0.com/oauth/token",
  jwks_uri: "https://tenant.us.auth0.com/.well-known/jwks.json",
};

const originalFetch = globalThis.fetch;
globalThis.fetch = async (url) => {
  if (String(url) === "https://tenant.us.auth0.com/.well-known/openid-configuration") {
    return { ok: true, json: async () => ({ ...mockOidcConfig }) };
  }
  return { ok: false, status: 404 };
};

const handler = require("../dist/extension.js");
if (typeof handler !== "function") {
  throw new Error(`Webtask requires the bundle to export a bare function, got ${typeof handler}`);
}

const context = {
  data: { AUTH0_DOMAIN: "tenant.us.auth0.com" },
  secrets: {},
};

const USE_WILDCARD_DOMAIN = 3;

function request(port, path) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", method: "GET", path, port }, (response) => {
      let body = "";
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        resolve({ body, status: response.statusCode });
      });
    });
    req.on("error", reject);
    req.end();
  });
}

const server = http.createServer((req, res) => {
  req.x_wt = { container: ".well-known", jtn: ".well-known", url_format: USE_WILDCARD_DOMAIN };
  handler(context, req, res);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

try {
  const port = server.address().port;
  const suffixed = await request(port, "/.well-known/oauth-protected-resource/auth0-whoami-mcp/mcp");
  const bare = await request(port, "/.well-known/oauth-protected-resource");
  const authServer = await request(port, "/.well-known/oauth-authorization-server");
  const landing = await request(port, "/.well-known/");
  const notFound = await request(port, "/.well-known/nope");

  const suffixedBody = JSON.parse(suffixed.body);
  if (suffixed.status !== 200 || !suffixedBody.resource.endsWith("/auth0-whoami-mcp/mcp")) {
    throw new Error(`Unexpected suffixed metadata response: ${suffixed.status} ${suffixed.body}`);
  }
  if (suffixedBody.authorization_servers[0] !== "https://tenant.us.auth0.com/") {
    throw new Error(`Unexpected authorization_servers: ${suffixed.body}`);
  }
  if (bare.status !== 404) {
    throw new Error(`Expected the bare (unsuffixed) resource path to 404, received ${bare.status}`);
  }
  const authServerBody = JSON.parse(authServer.body);
  if (authServer.status !== 200 || authServerBody.token_endpoint !== mockOidcConfig.token_endpoint) {
    throw new Error(`Unexpected authorization-server response: ${authServer.status} ${authServer.body}`);
  }
  if (landing.status !== 200) {
    throw new Error(`Unexpected landing response: ${landing.status}`);
  }
  if (notFound.status !== 404) {
    throw new Error(`Expected an unmatched path to 404, received ${notFound.status}`);
  }

  console.log(
    `suffixed=${suffixed.status} bare=${bare.status} authServer=${authServer.status} landing=${landing.status} notFound=${notFound.status}`,
  );
} finally {
  await new Promise((resolve) => server.close(resolve));
  globalThis.fetch = originalFetch;
}
