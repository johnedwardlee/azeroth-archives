# Azeroth Archives Desktop

An entirely offline Warcraft 5E character manager for Windows.

## Living character sheet

Version 0.4 adds persistent tools intended for use throughout a play session:

- Damage, healing, temporary HP, death saves, hit dice, inspiration, conditions, and long rests
- Saving-throw and skill proficiency tracking, including expertise, passive Perception, initiative, and normal/advantage/disadvantage d20 rolls
- A persistent attack workspace with custom attacks and one-click attacks created from carried weapons
- Feat selection from imported schema-2 content
- Known and prepared spells with editable spell-slot usage
- Imported and custom equipment, quantities, equipped state, item notes, weight, and currency
- Multi-page PDF export containing the character's tracked saving throws, skills, attacks, feats, spells, equipment, and conditions

Existing character saves are upgraded in memory with safe defaults and keep their original identity, statistics, features, and notes.

## Player data

Characters and imported content packs are stored locally in the operating system's application-data folder as `azeroth-archives-data.json`. The app makes no network requests and requires no account.

## Build an installer

```powershell
pnpm install
pnpm dist
```

The Windows installer is written to `release/`.

## Custom content

The `content-format/` directory contains the backward-compatible JSON schema, an example `.w5e` pack, and a prompt Codex can use when extracting rules from PDFs.

The app ships without a built-in rules pack. Import at least one `.w5e` pack through the Content Library to add ancestries, classes, backgrounds, feats, equipment, and spells.

Schema 1.0 supports ancestries, classes, and backgrounds. Schema 2.0 additionally supports subclasses, feats, equipment, spells, creatures, and page-referenced rules. Both versions can be imported.

The extracted 2024 handbook reference data is in `content-source/dnd5e-2024-phb/`. Its import-ready pack is `content-packs/dnd5e-2024-phb.w5e`. Regenerate that pack with:

```powershell
python content-tools/build_dnd2024_pack.py
```

The converter maps standard 5E Dexterity, Constitution, Intelligence, and Wisdom to the app's Agility, Stamina, Intellect, and Spirit abilities. It keeps the original PDF page reference on imported rules.

## PDF-to-pack workflow

1. Use the prompt in `content-format/CODEX-PROMPT.md` with a source PDF.
2. Keep extracted, page-referenced material under `content-source/<pack-id>/` for review.
3. Convert it into a schema-2 `.w5e` file under `content-packs/`.
4. Import the `.w5e` file through the Content Library.
5. Verify class/subclass features by creating and leveling a test character.
