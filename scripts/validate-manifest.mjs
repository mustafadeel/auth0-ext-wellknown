import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url)));
const webtaskJson = JSON.parse(await readFile(new URL("../webtask.json", import.meta.url)));

for (const key of ["name", "version", "description", "author", "keywords"]) {
  assert.ok(webtaskJson[key], `webtask.json must define ${key}`);
}
assert.equal(webtaskJson.name, ".well-known", "discovery extension must own the .well-known route");
assert.equal(packageJson.name, webtaskJson.name, "package.json and webtask.json must use the same name");
assert.deepEqual(
  packageJson["auth0-extension"].secrets,
  webtaskJson.secrets,
  "package.json and webtask.json must expose the same settings",
);
