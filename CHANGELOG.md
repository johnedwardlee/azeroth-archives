# Changelog

## 1.1.0

- Added multiclass advancement with class-specific levels, combined spell slots and resources, and separate Hit Dice pools.
- Added advancement history with one-step-at-a-time rollback of level statistics, features, feats, spells, and choices.
- Added companion, summon, and transformation tracking with editable combat values and imported creature references.
- Replaced the single notes page with a structured journal for sessions, quests, NPCs, locations, and lore while retaining a scratchpad.
- Added the Content Pack Workshop for live preview, schema validation, JSON editing, cloning, enabling/disabling, and `.w5e` export.
- Added save-store migration 4 for pack enabled state and character schema 4 for the new living-sheet records.
- Removed renderer schema compiler code generation so content validation works under the desktop security policy.
- Rebuilt PDF character sheets as a neutral Azeroth explorer's ledger with parchment, navy and brass framing, varied section icons, portrait support, a compact overview, and themed continuation pages.

## 1.0.1

- Serialized desktop storage operations and limited the app to one active instance to prevent overlapping local-data writes.
- Added complete runtime schema validation for content-pack imports and full-library restores.
- Added explicit store migrations, pre-migration backups, and protection against opening newer save formats in older builds.
- Added main-process integration tests for concurrent saves, backup recovery, migrations, and malformed data.
- Strengthened release gates so tests and content audits must pass before publication.
- Removed unused installer-signing configuration while retaining release checksums and documenting the unsigned SmartScreen flow.

## 1.0.0

- Promoted the tested 1.0 release candidate to the first stable release.
- Includes versioned saves and recovery, complete guided creation and advancement, living-sheet play tools, rules-aware actions and equipment, PDF export, desktop update controls, diagnostics, and automated release gates.

## 1.0.0-rc.1

- Added Settings & Updates with manual checks, download progress, restart-to-install, data-folder access, release notes, and privacy-safe diagnostics.
- Added complete full-library backup, rotating automatic backups, corruption recovery, and versioned save migrations.
- Added automated unit, migration, content, TypeScript, and production-build checks.
- Completed guided creation with class skill lists, ability-generation methods, background boosts, starting equipment, and GM-overridable prerequisite warnings.
- Added release checksums and optional Windows code-signing support.

## 0.9.3

- Completed guided character-creation rules and validation.

## 0.9.2

- Added automated tests, full backup and restore, automatic recovery, and explicit save versions.

## 0.9.1

- Added guided setup, advanced advancement choices, Actions dashboard, active effects and concentration, and equipment proficiency rules.
