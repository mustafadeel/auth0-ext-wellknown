"use strict";

var Webtask = require("webtask-tools");

var resourceMetadataPrefix = "/oauth-protected-resource/";
var authorizationServerPath = "/oauth-authorization-server";

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

function toAuth0Domain(value) {
  try {
    return new URL(value).host;
  } catch (error) {
    return value.replace(/^https?:\/\//, "").replace(/\/$/, "");
  }
}

function requestHeader(req, name) {
  var value = req.headers && req.headers[name.toLowerCase()];
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0];
  return undefined;
}

function requestPath(req) {
  return (req.url || "/").split("?", 1)[0];
}

function installedExtensionOrigin(req) {
  var webtaskUrl = req.x_wt && req.x_wt.ectx && req.x_wt.ectx.PUBLIC_WT_URL;
  if (typeof webtaskUrl === "string" && webtaskUrl) {
    try {
      return new URL(webtaskUrl).origin;
    } catch (error) {
      // fall through to header-based derivation
    }
  }

  var protocol = requestHeader(req, "x-forwarded-proto") || "https";
  var host = requestHeader(req, "x-forwarded-host") || requestHeader(req, "host");
  if (!host) throw new Error("Unable to determine the installed Webtask origin.");
  return protocol + "://" + host;
}

function tenantIssuer(context) {
  var domain = readSetting(context, "AUTH0_DOMAIN");
  if (!domain) {
    throw new Error("AUTH0_DOMAIN is unavailable in the Webtask runtime context.");
  }
  return "https://" + toAuth0Domain(domain) + "/";
}

function supportedScopes(context) {
  var configuredScopes = readSetting(context, "SUPPORTED_SCOPES");
  if (!configuredScopes) return [];

  return Array.from(new Set(configuredScopes.split(/\s+/).filter(Boolean)));
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

  if (req.method !== "GET") {
    return sendJson(res, 404, { error: "not_found" });
  }

  var path = requestPath(req);

  if (path === "/") {
    res.statusCode = 200;
    res.setHeader("content-type", "text/plain; charset=utf-8");
    return res.end("Auth0 MCP OAuth discovery extension");
  }

  if (path === authorizationServerPath) {
    var issuer;
    try {
      issuer = tenantIssuer(context);
    } catch (error) {
      return sendJson(res, 500, { error: "configuration_error", message: error.message });
    }
    return fetch(issuer + ".well-known/openid-configuration")
      .then(function (upstream) {
        if (!upstream.ok) {
          throw new Error("Auth0 returned " + upstream.status + " for openid-configuration.");
        }
        return upstream.json();
      })
      .then(function (metadata) {
        metadata.issuer = normalizeIssuer(typeof metadata.issuer === "string" ? metadata.issuer : issuer);
        return sendJson(res, 200, metadata);
      })
      .catch(function (error) {
        return sendJson(res, 502, { error: "upstream_error", message: error.message });
      });
  }

  if (path.indexOf(resourceMetadataPrefix) === 0) {
    var resourcePath = path.slice(resourceMetadataPrefix.length - 1);
    if (!resourcePath || resourcePath === "/") {
      return sendJson(res, 404, { error: "not_found" });
    }

    var origin;
    var tenantOrigin;
    try {
      origin = installedExtensionOrigin(req);
      tenantOrigin = tenantIssuer(context);
    } catch (error) {
      return sendJson(res, 500, { error: "configuration_error", message: error.message });
    }

    return sendJson(res, 200, {
      resource: origin + resourcePath,
      authorization_servers: [tenantOrigin],
      resource_name: "Auth0 MCP",
      scopes_supported: supportedScopes(context),
    });
  }

  return sendJson(res, 404, { error: "not_found" });
});
