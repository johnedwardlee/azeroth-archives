import type { ContentPack } from "./types";

type RecordValue = Record<string, unknown>;
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const abilities = new Set(["strength", "agility", "stamina", "intellect", "spirit", "charisma"]);

function record(value: unknown): value is RecordValue { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function allowed(value: RecordValue, keys: string[], path: string, errors: string[]) { for (const key of Object.keys(value)) if (!keys.includes(key)) errors.push(`${path}.${key} is not allowed`); }
function stringField(value: RecordValue, key: string, path: string, errors: string[], required = false) { const field = value[key]; if (field === undefined) { if (required) errors.push(`${path}.${key} is required`); } else if (typeof field !== "string" || (required && !field.length)) errors.push(`${path}.${key} must be a${required ? " non-empty" : ""} string`); }
function idField(value: RecordValue, key: string, path: string, errors: string[], required = false) { stringField(value, key, path, errors, required); if (typeof value[key] === "string" && !idPattern.test(value[key])) errors.push(`${path}.${key} must be a lowercase kebab-case id`); }
function stringArray(value: unknown, path: string, errors: string[], unique = false) { if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.length)) errors.push(`${path} must be an array of strings`); else if (unique && new Set(value).size !== value.length) errors.push(`${path} must not contain duplicates`); }
function aliases(value: RecordValue, path: string, errors: string[]) { if (value.aliases !== undefined) stringArray(value.aliases, `${path}.aliases`, errors, true); }

function feature(value: unknown, path: string, errors: string[]) {
  if (!record(value)) { errors.push(`${path} must be an object`); return; }
  allowed(value, ["id", "name", "aliases", "description", "source"], path, errors); idField(value, "id", path, errors); aliases(value, path, errors);
  stringField(value, "name", path, errors, true); stringField(value, "description", path, errors, true); stringField(value, "source", path, errors);
}

function levelFeatures(value: unknown, path: string, errors: string[]) {
  if (!record(value)) { errors.push(`${path} must be an object`); return; }
  for (const [level, entries] of Object.entries(value)) {
    if (!/^(?:[1-9]|1[0-9]|20)$/.test(level)) errors.push(`${path}.${level} must be a level from 1 to 20`);
    if (!Array.isArray(entries)) errors.push(`${path}.${level} must be an array`); else entries.forEach((entry, index) => feature(entry, `${path}.${level}[${index}]`, errors));
  }
}

function subclass(value: unknown, path: string, errors: string[]) {
  if (!record(value)) { errors.push(`${path} must be an object`); return; }
  allowed(value, ["id", "name", "aliases", "description", "levelFeatures"], path, errors); idField(value, "id", path, errors, true); aliases(value, path, errors);
  stringField(value, "name", path, errors, true); stringField(value, "description", path, errors); levelFeatures(value.levelFeatures, `${path}.levelFeatures`, errors);
}

function ancestry(value: unknown, path: string, errors: string[]) {
  if (!record(value)) { errors.push(`${path} must be an object`); return; }
  allowed(value, ["id", "name", "aliases", "speed", "abilityBonuses", "traits"], path, errors); idField(value, "id", path, errors, true); aliases(value, path, errors); stringField(value, "name", path, errors, true);
  if (!Number.isInteger(value.speed) || Number(value.speed) < 0) errors.push(`${path}.speed must be a non-negative integer`);
  if (value.abilityBonuses !== undefined) { if (!record(value.abilityBonuses)) errors.push(`${path}.abilityBonuses must be an object`); else for (const [key, bonus] of Object.entries(value.abilityBonuses)) if (!abilities.has(key) || !Number.isInteger(bonus) || Number(bonus) < -5 || Number(bonus) > 5) errors.push(`${path}.abilityBonuses.${key} is invalid`); }
  if (!Array.isArray(value.traits)) errors.push(`${path}.traits must be an array`); else value.traits.forEach((entry, index) => feature(entry, `${path}.traits[${index}]`, errors));
}

function classDefinition(value: unknown, path: string, errors: string[]) {
  if (!record(value)) { errors.push(`${path} must be an object`); return; }
  allowed(value, ["id", "name", "aliases", "hitDie", "primaryAbility", "description", "savingThrowProficiencies", "levelFeatures", "subclasses"], path, errors); idField(value, "id", path, errors, true); aliases(value, path, errors); stringField(value, "name", path, errors, true); stringField(value, "description", path, errors);
  if (![4, 6, 8, 10, 12].includes(Number(value.hitDie))) errors.push(`${path}.hitDie must be 4, 6, 8, 10, or 12`); if (typeof value.primaryAbility !== "string" || !abilities.has(value.primaryAbility)) errors.push(`${path}.primaryAbility is invalid`);
  if (value.savingThrowProficiencies !== undefined) { stringArray(value.savingThrowProficiencies, `${path}.savingThrowProficiencies`, errors, true); if (Array.isArray(value.savingThrowProficiencies) && value.savingThrowProficiencies.some((item) => !abilities.has(item))) errors.push(`${path}.savingThrowProficiencies contains an invalid ability`); }
  levelFeatures(value.levelFeatures, `${path}.levelFeatures`, errors); if (value.subclasses !== undefined) { if (!Array.isArray(value.subclasses)) errors.push(`${path}.subclasses must be an array`); else value.subclasses.forEach((entry, index) => subclass(entry, `${path}.subclasses[${index}]`, errors)); }
}

function background(value: unknown, path: string, errors: string[]) {
  if (!record(value)) { errors.push(`${path} must be an object`); return; }
  allowed(value, ["id", "name", "aliases", "skills", "feature", "abilityOptions", "featId", "toolProficiencies", "equipment"], path, errors); idField(value, "id", path, errors, true); aliases(value, path, errors); stringField(value, "name", path, errors, true); stringArray(value.skills, `${path}.skills`, errors);
  if (value.feature !== undefined) feature(value.feature, `${path}.feature`, errors); if (value.abilityOptions !== undefined) { stringArray(value.abilityOptions, `${path}.abilityOptions`, errors); if (Array.isArray(value.abilityOptions) && value.abilityOptions.some((item) => !abilities.has(item))) errors.push(`${path}.abilityOptions contains an invalid ability`); }
  idField(value, "featId", path, errors); if (value.toolProficiencies !== undefined) stringArray(value.toolProficiencies, `${path}.toolProficiencies`, errors); stringField(value, "equipment", path, errors);
}

function feat(value: unknown, path: string, errors: string[]) { if (!record(value)) { errors.push(`${path} must be an object`); return; } allowed(value, ["id", "name", "aliases", "category", "prerequisite", "description", "source"], path, errors); idField(value, "id", path, errors, true); aliases(value, path, errors); stringField(value, "name", path, errors, true); stringField(value, "category", path, errors, true); stringField(value, "prerequisite", path, errors); stringField(value, "description", path, errors, true); stringField(value, "source", path, errors); }
function equipment(value: unknown, path: string, errors: string[]) { if (!record(value)) { errors.push(`${path} must be an object`); return; } allowed(value, ["id", "name", "aliases", "category", "description", "cost", "weight", "damage", "damageType", "properties", "mastery", "source"], path, errors); idField(value, "id", path, errors, true); aliases(value, path, errors); stringField(value, "name", path, errors, true); stringField(value, "category", path, errors, true); ["description", "cost", "weight", "damage", "damageType", "mastery", "source"].forEach((key) => stringField(value, key, path, errors)); if (value.properties !== undefined) stringArray(value.properties, `${path}.properties`, errors); }
function spell(value: unknown, path: string, errors: string[]) { if (!record(value)) { errors.push(`${path} must be an object`); return; } allowed(value, ["id", "name", "aliases", "level", "school", "classes", "ritual", "castingTime", "range", "components", "duration", "description", "source"], path, errors); idField(value, "id", path, errors, true); aliases(value, path, errors); ["name", "school", "castingTime", "range", "components", "duration", "description"].forEach((key) => stringField(value, key, path, errors, true)); stringField(value, "source", path, errors); if (!Number.isInteger(value.level) || Number(value.level) < 0 || Number(value.level) > 9) errors.push(`${path}.level must be an integer from 0 to 9`); stringArray(value.classes, `${path}.classes`, errors); if (value.ritual !== undefined && typeof value.ritual !== "boolean") errors.push(`${path}.ritual must be a boolean`); }
function creature(value: unknown, path: string, errors: string[]) { if (!record(value)) { errors.push(`${path} must be an object`); return; } allowed(value, ["id", "name", "aliases", "challengeRating", "description", "source"], path, errors); idField(value, "id", path, errors, true); aliases(value, path, errors); stringField(value, "name", path, errors, true); stringField(value, "challengeRating", path, errors); stringField(value, "description", path, errors, true); stringField(value, "source", path, errors); }
function rule(value: unknown, path: string, errors: string[]) { if (!record(value)) { errors.push(`${path} must be an object`); return; } allowed(value, ["id", "name", "aliases", "category", "description", "source"], path, errors); idField(value, "id", path, errors, true); aliases(value, path, errors); stringField(value, "name", path, errors, true); stringField(value, "category", path, errors, true); stringField(value, "description", path, errors, true); stringField(value, "source", path, errors); }

export function contentPackValidationError(value: unknown) {
  const errors: string[] = [];
  if (!record(value)) return "Content pack must be an object.";
  allowed(value, ["schemaVersion", "pack", "ancestries", "classes", "backgrounds", "feats", "equipment", "spells", "creatures", "rules"], "content pack", errors);
  if (value.schemaVersion !== "1.0" && value.schemaVersion !== "2.0") errors.push("content pack.schemaVersion must be 1.0 or 2.0");
  if (!record(value.pack)) errors.push("content pack.pack is required"); else { allowed(value.pack, ["id", "name", "version", "description", "source"], "content pack.pack", errors); idField(value.pack, "id", "content pack.pack", errors, true); stringField(value.pack, "name", "content pack.pack", errors, true); stringField(value.pack, "version", "content pack.pack", errors, true); stringField(value.pack, "description", "content pack.pack", errors); stringField(value.pack, "source", "content pack.pack", errors); }
  const validators = { ancestries: ancestry, classes: classDefinition, backgrounds: background, feats: feat, equipment, spells: spell, creatures: creature, rules: rule } as const;
  for (const [category, validator] of Object.entries(validators)) { const entries = value[category]; if (entries === undefined) continue; if (!Array.isArray(entries)) errors.push(`content pack.${category} must be an array`); else entries.forEach((entry, index) => validator(entry, `content pack.${category}[${index}]`, errors)); }
  return errors.length ? errors.slice(0, 5).join("; ") : null;
}

export function assertContentPack(value: unknown): asserts value is ContentPack { const error = contentPackValidationError(value); if (error) throw new Error(error); }
