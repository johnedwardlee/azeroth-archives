# Azeroth Archives

Azeroth Archives is an offline-first Windows desktop character manager for a custom Warcraft 5E campaign. Players can create, advance, play, back up, and export characters without an account. Groups that want shared play can optionally link selected characters to a private Live Sync campaign.

## Player features

- Guided character creation with class skill and spell counts, standard array, point buy, rolled or manual scores, background ability boosts, starting equipment, Fighting Styles, Expertise, Weapon Masteries, and Magic Initiate choices
- Portable campaign profiles, first-launch onboarding, readiness validation, protected finalized creation choices, and single-file read-only DM reviews
- Guided single-class or multiclass advancement with rollback history, subclass checks, hit-point increases, feats, ability improvements, Expertise, Metamagic, spell choices, Fighting Styles, and Weapon Masteries
- Living hit points, temporary hit points, death saves, class-specific hit dice, inspiration, conditions, rests, class resources, concentration, and active effects
- Rules-aware Actions dashboard generated from features, attacks, prepared spells, and equipped items
- Attacks, saves, skills, expertise, defenses, spell slots, prepared spells, equipment, currency, encumbrance, attunement, ammunition, charges, and consumables
- Equipment proficiency, armor restrictions, equipment slots, mastery status, and conflict warnings
- Companion, summon, and transformation trackers plus a structured journal for sessions, quests, NPCs, locations, and lore
- Local portraits, notes, individual character backups, full-library backups, and multi-page PDF character sheets
- An in-app Content Pack Workshop for previewing, validating, editing, enabling, disabling, cloning, and exporting `.w5e` content
- Automatic GitHub-hosted application updates with a manual update screen
- Optional private Live Sync campaigns with a DM party dashboard, controlled remote sheet management, presence, reconnect recovery, and shared or hidden dice rolls

The approved Warcraft campaign pack is included and updated with the application. Additional schema-compatible `.w5e` packs can be imported or created in the Content Pack Workshop.

## Install and update

Download the latest `Azeroth-Archives-Setup-<version>.exe` from the [GitHub Releases page](https://github.com/johnedwardlee/azeroth-archives/releases). The installer creates optional desktop and Start menu shortcuts.

Installed copies check GitHub for updates after launch. Open the local-data button in the application header to check manually, review update status, restart into a downloaded update, open the data folder, or export diagnostics.

Every published version remains available on GitHub as a rollback point. Back up all characters before manually installing an older version; older builds may not understand data created by newer releases.

## Local data, backups, and recovery

Characters, campaign profiles, onboarding preferences, and imported packs are stored in `azeroth-archives-data.json` under the operating system's application-data folder. The Settings & Updates panel shows the exact path.

The desktop app runs as a single instance, serializes local-data changes, writes atomically, and keeps up to ten rotating backups in the adjacent `backups` directory. If the primary file becomes unreadable, the app restores the newest valid automatic backup and reports that recovery in the roster status. Store-version upgrades create a dedicated pre-migration backup before changing the saved format.

Use **Back up everything** before major campaign or application changes. A full backup includes every character and imported pack. Restoring a full backup replaces the current local library after an explicit confirmation. Individual characters can also be exported and imported as new copies.

## Privacy and diagnostics

Characters remain stored locally and all offline features work without an account. If a player explicitly links a character to Live Sync, the linked character snapshot, campaign membership, mutation metadata, presence, and recent shared roll history are also sent to the configured Supabase project so authorized campaign members can synchronize. Unlinked characters and imported content packs are not uploaded by Live Sync. Unlinking always keeps the local sheet and lets the user choose whether that character's previous shared rolls remain in campaign history.

The desktop network allowlist permits GitHub hosts used for application updates and, when configured, the campaign's Supabase HTTPS and secure WebSocket hosts. Authentication sessions are protected with the operating system's encrypted credential storage. Exported diagnostics contain application versions, connection state, and record counts, but not character-sheet contents or authentication tokens.

## Build and test

Requirements: Node.js 24 and pnpm 11.

```powershell
pnpm install --frozen-lockfile
pnpm test
pnpm release:win
```

`pnpm test` runs the unit and migration suite, TypeScript validation, and the production renderer build. GitHub Actions repeats those checks, validates the bundled content schema, and audits the pack text on every push and pull request.

The Windows installer is written to `release/`. It is distributed unsigned, so Windows may show a Microsoft Defender SmartScreen warning on first installation; select **More info** and then **Run anyway** to continue.

## Custom content and PDF extraction

The `content-format/` directory contains the schema, example packs, and `CODEX-PROMPT.md` for extracting page-referenced material from PDFs. Imported packs and restored libraries are checked against the complete schema before they are stored. The recommended workflow is:

1. Extract and review source material under `content-source/<pack-id>/`.
2. Convert it to a schema-2 `.w5e` file under `content-packs/`.
3. Run `node content-tools/validate_content_pack.cjs <pack-path>`.
4. Import the pack and test character creation and advancement.

The included Warcraft pack is generated by `content-tools/build_warcraft5e_pack.py` and audited by `content-tools/audit_warcraft5e_pack.py`.

## Known limitations

- The Windows installer is unsigned, so Microsoft Defender SmartScreen can require **More info → Run anyway** during installation or updates.
- Live Sync requires an internet connection and the configured Supabase service. Linked characters remain usable locally while offline and queue changes for reconnection, but other campaign members will not see those changes until synchronization resumes.
- Multiclass eligibility and any campaign-specific proficiency grants are presented for GM review rather than enforced automatically.
- Free-form and unusually worded prerequisites are shown as warnings for GM review rather than enforced automatically.
- Some starting-equipment descriptions contain campaign choices that cannot be matched to a single catalog item. The guide imports recognized items and allows the GM to approve substitutions.
- The application targets Windows x64.

## Attribution and disclaimer

This is an unofficial fan-made campaign tool and is not endorsed by or affiliated with Blizzard Entertainment, Wizards of the Coast, or their parent companies. Warcraft, World of Warcraft, and related names and marks belong to their respective owners. Only distribute rules text, artwork, and other content you have permission to share.
