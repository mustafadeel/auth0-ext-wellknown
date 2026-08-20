import { createRequire } from "node:module";
import http from "node:http";

const require = createRequire(import.meta.url);
const handler = require("../dist/extension.js");
if (typeof handler !== "function") {
  throw new Error(`Webtask requires the bundle to export a bare function, got ${typeof handler}`);
}

const context = {
  data: {
    MCP_RESOURCE_URL: "https://tenant.us.webtask.run/auth0-whoami-mcp/mcp",
    AUTH0_TENANT_ORIGIN: "https://tenant.us.auth0.com",
  },
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
  const bare = await request(port, "/.well-known/oauth-protected-resource");
  const suffixed = await request(port, "/.well-known/oauth-protected-resource/auth0-whoami-mcp/mcp");
  const landing = await request(port, "/.well-known/");
  const notFound = await request(port, "/.well-known/nope");

  if (bare.status !== 200 || !bare.body.includes("tenant.us.webtask.run")) {
    throw new Error(`Unexpected bare metadata response: ${bare.status} ${bare.body}`);
  }
  if (suffixed.status !== 200 || !suffixed.body.includes("tenant.us.webtask.run")) {
    throw new Error(`Unexpected suffixed metadata response: ${suffixed.status} ${suffixed.body}`);
  }
  if (landing.status !== 200) {
    throw new Error(`Unexpected landing response: ${landing.status}`);
  }
  if (notFound.status !== 404) {
    throw new Error(`Expected an unmatched path to 404, received ${notFound.status}`);
  }

  console.log(`bare=${bare.status} suffixed=${suffixed.status} landing=${landing.status} notFound=${notFound.status}`);
} finally {
  await new Promise((resolve) => server.close(resolve));
}
