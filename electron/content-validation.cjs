const fs = require("node:fs");
const path = require("node:path");
const Ajv2020 = require("ajv/dist/2020").default;

const schemaPath = path.join(__dirname, "..", "content-format", "warcraft5e-content.schema.json");
const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: false });
const validateContentPackSchema = ajv.compile(schema);

function contentPackValidationError(value) {
  if (validateContentPackSchema(value)) return null;
  const errors = validateContentPackSchema.errors ?? [];
  return errors
    .slice(0, 5)
    .map((error) => `${error.instancePath || "content pack"} ${error.message ?? "is invalid"}`)
    .join("; ") || "The content pack does not match the supported schema.";
}

function assertContentPack(value) {
  const error = contentPackValidationError(value);
  if (error) throw new Error(`Invalid content pack: ${error}`);
}

module.exports = { assertContentPack, contentPackValidationError };
