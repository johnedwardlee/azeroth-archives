# Codex content extraction prompt

Use this prompt with a Warcraft 5E rules PDF and the adjacent JSON schema.

> Read the attached rules PDF and create one Warcraft 5E schema-2 content pack that validates against `warcraft5e-content.schema.json`. Transcribe rules faithfully, preserve feature names, and do not invent missing mechanics. Use stable lowercase kebab-case IDs. Map Dexterity to Agility, Constitution to Stamina, Intelligence to Intellect, and Wisdom to Spirit when adapting standard 5E material. Put the PDF filename and relevant PDF page number in every available `source` field. Extract all collections actually present: ancestries/species, classes, subclasses, backgrounds, feats, equipment, spells, creatures, and rules references. Preserve ambiguous tables as page-referenced rule text instead of guessing individual cells. Return one UTF-8 `.w5e` JSON file, list any OCR fallbacks separately, and report schema validation plus record counts.

The importer accepts schema 1.0 and 2.0 files with `.json` or `.w5e` extensions. A `.w5e` file is ordinary UTF-8 JSON with a game-specific filename.

## Recommended extraction sequence

1. Render representative pages and visually verify headings, columns, and tables.
2. Extract page text and the PDF bookmark outline.
3. Build an auditable source-reference directory with page references.
4. Convert the source reference into one schema-2 `.w5e` pack.
5. Validate IDs, required fields, record counts, and subclass level features.
6. Import the pack and test character creation plus level-up behavior.
