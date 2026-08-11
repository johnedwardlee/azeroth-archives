import { describe, expect, it } from "vitest";
import { assertContentPack, contentPackValidationError } from "./content-validation";

describe("content pack runtime validation", () => {
  it("accepts a minimal schema-compatible pack", () => {
    const pack: unknown = { schemaVersion: "2.0", pack: { id: "test-pack", name: "Test Pack", version: "1.0.0" } };
    expect(() => assertContentPack(pack)).not.toThrow();
  });

  it("rejects malformed nested collections", () => {
    const pack = { schemaVersion: "2.0", pack: { id: "test-pack", name: "Test Pack", version: "1.0.0" }, ancestries: {} };
    expect(contentPackValidationError(pack)).toMatch(/ancestries/);
    expect(() => assertContentPack(pack)).toThrow();
  });
});
