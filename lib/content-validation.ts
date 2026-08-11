import Ajv2020, { type ErrorObject } from "ajv/dist/2020";
import contentPackSchema from "../content-format/warcraft5e-content.schema.json";
import type { ContentPack } from "./types";

const ajv = new Ajv2020({ allErrors: true, strict: false });
const validateContentPackSchema = ajv.compile(contentPackSchema);

function validationSummary(errors: ErrorObject[] | null | undefined) {
  if (!errors?.length) return "The content pack does not match the supported schema.";
  return errors
    .slice(0, 5)
    .map((error) => `${error.instancePath || "content pack"} ${error.message ?? "is invalid"}`)
    .join("; ");
}

export function contentPackValidationError(value: unknown) {
  return validateContentPackSchema(value) ? null : validationSummary(validateContentPackSchema.errors);
}

export function assertContentPack(value: unknown): asserts value is ContentPack {
  const error = contentPackValidationError(value);
  if (error) throw new Error(error);
}
