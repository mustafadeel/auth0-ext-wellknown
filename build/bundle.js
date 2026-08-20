"use strict";

var Webtask = require("webtask-tools");

function readSetting(context, key) {
  var sources = [context && context.data, context && context.secrets, context];
  for (var index = 0; index < sources.length; index += 1) {
    var source = sources[index];
    if (source && typeof source[key] === "string" && source[key].trim()) return source[key].trim();
  }
  return undefined;
}

function sendJson(res, status, body) {
  var payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("content-length", Buffer.byteLength(payload));
  res.end(payload);
}

function normalizeIssuer(value) {
  return value.replace(/\/$/, "") + "/";
}

function metadataPath(resourceUrl) {
  var resource = new URL(resourceUrl);
  return "/.well-known/oauth-protected-resource" + resource.pathname;
}

function requestPath(req) {
  return (req.url || "/").split("?", 1)[0];
}

module.exports = Webtask.fromConnect(function handler(req, res) {
  var context = req.webtaskContext;
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("access-control-allow-headers", "authorization, content-type");
    res.setHeader("access-control-allow-methods", "GET, OPTIONS");
    res.setHeader("access-control-allow-origin", "*");
    return res.end();
  }

  var resourceUrl = readSetting(context, "MCP_RESOURCE_URL");
  var tenantOrigin = readSetting(context, "AUTH0_TENANT_ORIGIN");
  if (!resourceUrl || !tenantOrigin) {
    return sendJson(res, 500, {
      error: "configuration_error",
      message: "MCP_RESOURCE_URL and AUTH0_TENANT_ORIGIN must be configured.",
    });
  }

  var expectedPath;
  try {
    expectedPath = metadataPath(resourceUrl);
  } catch (error) {
    return sendJson(res, 500, { error: "configuration_error", message: "MCP_RESOURCE_URL must be an absolute URL." });
  }

  if (req.method === "GET" && requestPath(req) === expectedPath) {
    return sendJson(res, 200, {
      resource: resourceUrl,
      authorization_servers: [normalizeIssuer(tenantOrigin)],
      resource_name: readSetting(context, "RESOURCE_NAME") || "Auth0 MCP",
    });
  }

  if (req.method === "GET" && (requestPath(req) === "/" || requestPath(req) === "/.well-known")) {
    res.statusCode = 200;
    res.setHeader("content-type", "text/plain; charset=utf-8");
    return res.end("Auth0 MCP OAuth discovery extension");
  }

  return sendJson(res, 404, { error: "not_found" });
});
