import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const dist = new URL("../dist/", import.meta.url);
const sourcePackage = JSON.parse(await readFile(new URL("../package.json", import.meta.url)));

const extensionPackage = {
  name: sourcePackage.name,
  version: sourcePackage.version,
  description: sourcePackage.description,
  main: "index.js",
  keywords: sourcePackage.keywords,
  author: sourcePackage.author,
  repository: sourcePackage.repository,
  engines: sourcePackage.engines,
  license: sourcePackage.license,
  "auth0-extension": sourcePackage["auth0-extension"],
};

await mkdir(dist, { recursive: true });
await copyFile(new URL("../src/handler.js", import.meta.url), new URL("extension.js", dist));
await writeFile(new URL("index.js", dist), 'module.exports = require("./extension");\n');
await writeFile(new URL("package.json", dist), `${JSON.stringify(extensionPackage, null, 2)}\n`);
await copyFile(new URL("../src/handler.js", import.meta.url), new URL("../build/bundle.js", import.meta.url));
