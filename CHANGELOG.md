# Changelog

## Unreleased

## 1.3.0

- Rebuilt the exported character sheet to match the approved neutral Warcraft design with runic framing, a portrait plate, carved stat panels, varied section symbols, and themed continuation pages; removed the discarded slogan, compass medallions, and bottom labels.
- Replaced folder-based DM review packages with one versioned, importable JSON file containing the character and readiness report.
- Made Guided Setup and Session-Zero Preflight collapsible with per-character saved expansion state and compact summaries.
- Extended collapsible panels to class resources, active effects, spell slots, and equipment load summaries.
- Made the Content Pack Workshop responsive and removed the narrow-drawer width conflict that caused horizontal page scrolling.
- Added a reusable live combat-status strip to the Actions screen with editable HP, temporary HP, inspiration, conditions, concentration, spell slots, and class resources.
- Added per-character action favorites, a quick bar, recent-action history, ammunition consumption, and immediate one-step undo for resource expenditure.
- Upgraded character saves to schema 6 for action favorites and recent-use history.

## 1.2.2

- Added guided Magic Initiate setup for its spell list, casting ability, two cantrips, same-list level-1 spell, and free Long Rest casting.
- Added readiness enforcement and visible progress for starting class cantrips, learned spells, prepared spells, and maximum spell level.

## 1.2.1

- Fixed feat-granted spell lists so a Paladin with the Faithful Initiate background can select the cantrips and spells provided by Magic Initiate without enabling all class lists.

## 1.2.0

- Added portable campaign profiles for starting level and XP, allowed content and ability methods, advancement policy, encumbrance, attunement, equipment options, and house rules.
- Added a first-launch Player or Dungeon Master onboarding flow with campaign-profile import and local-data guidance.
- Added a character readiness preflight that separates blocking creation errors from GM-review warnings.
- Added character finalization that protects ancestry, class, background, ability, training, and starting-equipment choices while leaving the living sheet and advancement available.
- Added one-step DM review package export containing the character PDF, a validation report, and an importable read-only review copy.
- Upgraded the local store to version 5 with campaign-profile, role, and onboarding migrations included in full backups.

## 1.1.1

- Applied feat-granted ability increases during level-up and preserved them through advancement rollback.
- Added per-class ownership, spellcasting statistics, ritual behavior, and preparation limits for multiclass spells.
- Enforced prepared-spell and incapacitation restrictions on the Actions dashboard.
- Upgraded character saves to schema 5 with strict normalization and Electron persistence validation.
- Synchronized conditions with active effects, concentration loss, expiration, and rests.
- Made identical equipment independent inventory instances with separately linked attacks and usage tracking.
- Ensured full backups flush the currently open character before export.
- Repaired Warcraft content extraction artifacts and expanded the prose audit to prevent recurrence.

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
