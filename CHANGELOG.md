# Changelog

## Unreleased

- Audit every bundled class's level-2 advancement: prompt for Expertise, Metamagic, Fighting Styles, Blessed Warrior/Nature Warrior cantrips, and newly learned or prepared spells; automatically restore missing level-2 features and limited-use resources on existing characters.
- Restore Paladin's Divine Smite as an always-prepared spell with its once-per-Long-Rest free casting, apply Monk Unarmored Movement and Bard Jack of all Trades mechanically, and remove the standard bonus-language grant from Hunter's Deft Explorer.
- Expand Monk’s Focus into distinct Encounter choices for Flurry of Blows, both Patient Defense options, and both Step of the Wind options; connect every Focus-spending class and subclass feature to the Focus Points tracker with its correct cost and action timing.

## 2.0.2

- Show every known spell in the DM Spell controls, ordered by spell level and name, with prepared state, source, casting metadata, and expandable descriptions.
- Fix DM Party quick-view Armor Class by using the same equipped armor and shield calculation as the live character sheet.

## 2.0.1

- Automatically track Lucky feat Luck Points, scale their maximum with Proficiency Bonus, preserve spent points when that maximum increases, and restore them on a Long Rest.
- Add confirmed character unlinking for players and campaign removal for DMs while always preserving the complete local sheet.
- Let either role explicitly retain or delete that character's shared campaign roll history during unlinking.
- Archive unlinked server snapshots, revoke their player membership, block further mutations and rolls, clear stale local sync queues, and support safely relinking the same local character later.
- Correct live-campaign refresh so removed characters do not retain stale link metadata on the DM device.

## 2.0.0

- Release opt-in, offline-first Live Sync for private campaigns, including authenticated invitations, encrypted local sessions, revisioned character updates, durable offline queues, reconnect recovery, and database-enforced membership permissions.
- Add the DM Party workspace with live character summaries, controlled sheet editing, always-available resource, condition, spell, and equipment management, and safeguards around identity, advancement, and destructive changes.
- Share visible initiative, attack, spell, damage, healing, resource, and custom dice rolls with the party while keeping hidden DM rolls private, including after reconnects and application restarts.
- Consolidate active play around the Encounter workspace, with Party Rolls and Initiative first, rules-aware actions, exact roll math, combat status, session tracking, favorites, and recent actions.
- Complete multi-client release verification with one DM and two player installations, including simultaneous edits, offline replay, hidden-roll isolation, cross-player access denial, membership revocation, updates, backups, and recovery.

## 2.0.0-beta.8

- Move the shared Party Rolls workspace to the top of the player Encounter view and place Initiative inside its dice roller, with character modifiers and d20 advantage or disadvantage applied before publishing the result to the party.
- Reset the Party Rolls expansion preference so the relocated Initiative control opens visibly for existing players after updating.

## 2.0.0-beta.7

- Add a collapsible player dice workspace and live party roll feed to Encounter, including common dice, custom formulas and modifiers, and d20 advantage or disadvantage.
- Share visible rolls with every campaign member while allowing the DM to hide individual rolls behind database-enforced permissions and a party-safe Realtime channel.
- Show concentration in the DM party overview, add always-available standard-condition controls, and make DM Equipment and Spells controls collapsible per character.
- Debounce journal typing into one durable live-sync mutation after 10 idle seconds, flush on blur or discrete journal actions, and preserve queued text across restarts without blocking other updates.

## 2.0.0-beta.6

- Add a DM dice roller with common dice shortcuts, custom formulas and modifiers, d20 advantage/disadvantage, and live publication to the party roll feed.
- Add a confirmed, DM-authorized action to clear campaign roll history, including a safe follow-up Supabase migration for existing campaigns.
- Add Initiative to the player Encounter workspace and identify shared player rolls by character name instead of player name.
- Roll imported Healing Potions directly from Encounter and consume them, even when they were not manually marked as equipped consumables.
- Correct Priest and other healing-spell rolls by applying spellcasting ability modifiers, spell-slot upcasting, and separate healing-versus-damage formula detection.

## 2.0.0-beta.5

- Replace the DM equipment and spell selectors with searchable, description-rich pickers matching the player-facing library controls.
- Let the DM add custom equipment and directly adjust every carried item's quantity and ammunition without enabling full-sheet editing.
- Keep charge restoration available and clear pending picker input when the DM changes the selected party member.

## 2.0.0-beta.4

- Preserve cleared optional character fields, including concentration state, across JSON live-sync mutations so ended concentration stays ended on every connected app.
- Monitor Realtime channel failures, rebuild private campaign and character subscriptions with bounded backoff, refresh authorization tokens, and reconcile a fresh server snapshot after reconnecting.

## 2.0.0-beta.3

- Fix campaign invitation redemption by removing an ambiguous `campaign_id` reference from the Supabase function and provide a follow-up migration for existing beta databases.
- Preserve structured Supabase messages, details, hints, and error codes when live-sync failures cross the Electron IPC boundary.

## 2.0.0-beta.2

- Fix player invitation-code entry in the Live Sync panel by preserving input focus, normalizing typed or pasted codes, and formatting separators automatically.

## 2.0.0-beta.1

- Add opt-in, offline-first live synchronization through a private Supabase campaign service, with encrypted desktop sessions, device-bound player identities, single-use invitations, revisioned mutations, and a persistent reconnect outbox.
- Add the DM Party workspace with live character summaries, player presence, linked-sheet inspection, centralized party rolls, and per-character full-edit safety controls.
- Let the DM add equipment and spells and increase or reduce current HP, spell slots, Hit Dice, class resources, charges, and ammunition without enabling full editing.
- Publish initiative, attacks, spell attacks, checks, saves, damage, healing, Hit Dice, concentration, and spell-effect rolls to the DM feed while keeping local rolls functional offline.
- Restrict players to owner-authorized character channels, keep campaign-wide changes DM-only, retain at most 500 rolls for 30 days, and preserve existing offline characters and backups through store version 6.

## 1.5.5

- Add guided ancestry setup and finalization checks for Human Skillful and Versatile choices, High Elf Keen Senses and lineage magic, and Gnome lineage magic.
- Apply Dwarven Resilience, Dwarven Toughness, and Stonecunning automatically, including correct level-one and level-up hit points.
- Support ancestry and feat spells with their proper casting ability and independent once-per-Long-Rest free casts in the living sheet and Encounter workspace.
- Restore complete Stonecunning usage text and the full Skilled proficiency choices in the Warcraft 5E content pack.

## 1.5.4

- Recalculate level-one starting hit points when Stamina changes during character creation.

## 1.5.3

- Replace variant encumbrance with standard 5e carrying capacity (Strength × 15), remove the variant campaign option, and migrate existing variant profiles to the standard rule.

## 1.5.2

- Move favorited Encounter actions to the top of the filtered action list and remove the redundant Quick Bar section.

## 1.5.1

- Replaced generic Encounter `Roll` and `Cast` button labels with the exact d20 modifier, advantage/disadvantage dice, spell save DC, or a clear no-roll label.
- Fixed Encounter spell damage resolution: automatic-hit spells such as Arcane Missiles now roll damage on cast, saving-throw spells expose their damage roll, spell attacks retain critical damage, and standard cantrip/upcast scaling is applied.
- Keep the Encounter choice count, filters, and action cards together in one initially expanded panel so existing characters cannot appear to have choices without displaying them.
- Move the complete During Play session tracker from Character to Encounter, immediately after the unified action library.
- Resolve tracked weapon and spell attacks inline with Normal, Advantage, and Disadvantage modes; apply proficiency, ability, attack, condition, armor, encumbrance, and exhaustion modifiers; and expose normal and critical damage rolls.
- Share one d20 roll implementation between Encounter and detailed Combat management so both screens use identical dice selection rules.

## 1.5.0

- Replace the former Overview, Features, Actions, Combat, Spells, Equipment, Companions, and Notes tabs with Encounter, Character, Spellbook, Inventory, Companions, and Journal.
- Make Encounter the default play screen for finalized characters and DM review copies while unfinished characters continue to open on Character setup.
- Add a unified Encounter library for attacks, prepared spells, features, usable equipment, active companion commands, and standard combat actions.
- Add action-economy and purpose filters, full-library search, visible availability explanations, responsive action cards, favorites, recent actions, and one-step resource undo.
- Consolidate vitals, abilities, identity, features, advancement, checks, attacks, and defenses into the Character screen for detailed management.
- Move the finalized Character Setup Complete control below the active character view while keeping unfinished Session-Zero and creation choices at the top.

## 1.4.0

- Made every primary character-workspace section collapsible, saved each panel's state per character, and added visible-page Expand all / Collapse all controls.
- Hide Session-Zero Preflight, Guided Setup, starting-spell requirements, and background spell setup after character finalization; add one persistent play-view toggle to review or hide them together.
- Keep collapsible section headers interactive in read-only DM review imports while leaving character editing controls locked.

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
