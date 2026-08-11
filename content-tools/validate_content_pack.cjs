#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const Ajv = require("ajv/dist/2020").default;

const packPath = path.resolve(process.argv[2] || "content-packs/dnd2024-wikidot.w5e");
const schemaPath = path.resolve("content-format/warcraft5e-content.schema.json");
const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
const pack = JSON.parse(fs.readFileSync(packPath, "utf8"));
const ajv = new Ajv({ allErrors: true, strict: false });
const valid = ajv.validate(schema, pack);

if (!valid) {
  console.error(ajv.errorsText(ajv.errors, { separator: "\n" }));
  process.exit(1);
}

console.log(`Schema validation passed: ${packPath}`);
