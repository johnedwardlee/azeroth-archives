# Future UX Roadmap

This document records interface work to revisit after the pre-session character-creation rules are stable. It is planning material, not a commitment to the next release.

## UI revamp release plan

Version 1.4.0 is the foundation release for this redesign. It completes workspace-wide collapsible panels, per-character display preferences, the persistent combat strip, action favorites and history, resource undo, finalized-setup hiding, and read-only DM review behavior.

### 1.5.0 — Navigation and Encounter workspace

**Status:** Completed. The primary navigation is consolidated into six destinations, finalized characters open in Encounter, and the unified action library combines character, spell, item, companion, and standard actions with action-economy and purpose filters.

- Reduce the primary navigation to Encounter, Character, Spellbook, Inventory, Companions, and Journal.
- Make Encounter the default during active sessions while retaining detailed management screens.
- Keep HP, temporary HP, Armor Class, speed, inspiration, conditions, concentration, spell slots, class resources, and urgent warnings visible in the combat strip.
- Combine attacks, prepared spells, features, usable equipment, standard actions, and companion actions in one searchable library.
- Add filters for action economy and purpose without hiding unavailable options or their explanations.
- Keep common actions within two clicks and preserve the current Warcraft visual direction.

### 1.5.1 — Contextual action resolution

- Open attacks, spells, healing, items, and features in one inline resolution drawer.
- Support Normal, Advantage, Disadvantage, damage and healing rolls, saves, upcasting, targets, ammunition, charges, spell slots, class resources, concentration, and active effects.
- Show a concise result and retain immediate undo for accidental expenditure.

### 1.6.0 — Character management redesign

- Organize the Character screen into Vitals, Abilities, Identity, Features, Advancement, and Setup.
- Move editing controls away from high-frequency play information.
- Keep completed creation choices under the existing Setup toggle.
- Use the same organization for read-only DM review imports, without editing controls.

### Final responsive, accessibility, and polish pass

- Test every screen at the minimum supported window size and remove whole-page horizontal scrolling.
- Preserve keyboard navigation, visible focus, screen-reader names, and accurate expanded states.
- Keep urgent state visible when panels are collapsed.
- Add quick-bar reordering and consider an optional command palette after real-session feedback.
- Add screenshot-based visual regression coverage before removing the legacy Actions and Combat navigation.

## Collapsible sections

**Status:** Completed in version 1.4.0 across the primary character workspace. The reusable component includes compact summaries, per-character saved expansion state, keyboard-accessible headers, and active-page Expand all / Collapse all controls.

Make large panels collapsible throughout the app, beginning with:

- Guided Setup
- Session-Zero Preflight / character readiness checklist
- Magic Initiate setup and other feat-choice panels
- Spell slots and spellcasting statistics
- Class resources, active effects, and conditions
- Equipment, currency, encumbrance, and attunement summaries

Expected behavior:

- The section header is always visible and acts as the expand/collapse control.
- A collapsed header shows a compact summary, such as `4 of 6 complete`, `3 errors`, `18/26 HP`, or `2/4 slots`.
- Sections containing an unresolved creation error open automatically when the player follows the error link.
- Expansion state persists locally per character and per screen.
- Provide `Expand all` and `Collapse all` where a page contains several sections.
- Collapsing a section must not hide urgent combat state such as unconsciousness, concentration, or over-capacity penalties.
- Controls remain keyboard accessible and expose the correct expanded state to screen readers.

## Problem with the current play flow

Actions, Combat, and Spells are organized well for managing a character, but not for taking a turn. A player may need to move between tabs to:

1. Check current conditions, concentration, and resources.
2. Find an attack, feature, item, or spell.
3. Roll or cast it.
4. Spend a spell slot, charge, or class resource.
5. Apply an effect or update the target's result.

The app should distinguish between **character management** and **active play**. Detailed editing screens can remain separate while the most common turn actions are consolidated.

## Recommended direction: Encounter workspace

**Status:** Implemented in version 1.5.0. **Encounter** is the default play screen for finalized characters and combines the information needed to take a turn while detailed management remains available under Character, Spellbook, Inventory, and Companions.

### Persistent combat strip

Keep a compact strip visible at the top of the Encounter workspace:

- Current and temporary HP
- Armor Class and speed
- Inspiration
- Conditions and exhaustion
- Concentration
- Remaining spell slots
- Important class resources
- Current round/turn, if initiative tracking is active

Values should be editable or usable in place. Clicking a condition, resource, or spell-slot summary expands its relevant controls without navigating away.

### Unified action library

Combine executable choices from every source into one searchable list:

- Weapon and unarmed attacks
- Class and ancestry features
- Cantrips and prepared spells
- Consumables and usable equipment
- Companion actions
- Dash, Disengage, Dodge, Help, Hide, Ready, Search, and other standard actions

Each entry should identify its source, action cost, range, attack/save information, damage or healing formula, and resource cost. Executing an entry should roll and consume the appropriate resource in one place.

### Action-economy filters

Provide prominent filters or lanes for:

- Action
- Bonus Action
- Reaction
- Movement
- Free / Other

Also provide filters for attacks, spells, healing, defense, control, and items. Unavailable actions should explain why they are unavailable instead of disappearing—for example, `No level-2 slot`, `Reaction already used`, or `Armor blocks casting`.

### Favorites and quick bar

Allow players to pin their most-used actions to a short quick bar. Suggested defaults can be generated from equipped weapons, prepared spells, and frequently used class features.

The quick bar should support:

- Drag or menu-based reordering
- A visible action-cost badge
- Remaining uses or ammunition
- One-click roll/cast/use
- Expandable details without leaving the workspace

### Contextual resolution drawer

Selecting an action opens an inline drawer rather than another tab. The drawer can contain:

- Attack, damage, healing, or saving-throw roll
- Normal, Advantage, or Disadvantage mode
- Upcast level
- Target count
- Resource and ammunition expenditure
- Concentration or active-effect creation
- A concise result message
- Immediate undo for accidental resource expenditure

## Alternative concepts

### Turn planner

Show Action, Bonus Action, Movement, and Reaction slots for the current turn. Players drag or select abilities into each slot, then resolve them. This teaches action economy well but may feel restrictive for experienced players and requires more state management.

### Command palette

Provide a fast searchable overlay opened by a keyboard shortcut. Typing `fire`, `heal`, or `bonus` finds valid actions across features, attacks, spells, and items. This is valuable as a secondary expert feature but is not discoverable enough to be the primary combat UI.

### Fully merged play tab

Replace Actions, Combat, and Spells with one large page. This minimizes navigation but risks becoming dense and makes character maintenance harder. Prefer the Encounter workspace plus retained management tabs.

## PDF export fidelity

**Status:** Implemented. The exported sheet now uses the approved neutral Warcraft direction across overview and continuation pages, with runic framing, varied symbols, a portrait plate, navy/brass carved panels, no faction imagery, no slogan, and no bottom labels. The generated preview is rendered and visually checked as part of release QA.

Before this revision, the generated character-sheet PDF did not match the approved Warcraft-themed design. The approved Option 4 artwork remains the visual source of truth for the exported sheet.

- Rebuild the PDF template around the approved typography, borders, parchment treatment, blue-and-gold palette, visual hierarchy, and page composition.
- Use general Warcraft-inspired ornamentation only: no Alliance symbols, faction slogans, or bottom labels.
- Keep the varied symbol treatment from the final mockup instead of repeating compass icons throughout the sheet.
- Preserve practical character-sheet requirements such as readable print contrast, selectable text where possible, sensible page breaks, and support for long spell, feature, and equipment lists.
- Add reference-image comparisons or other visual regression checks so later PDF changes cannot silently drift away from the approved design.

## Responsive content creation editor

**Status:** Implemented. The workshop now uses the full available drawer width, removes the conflicting fixed-width rule, hides the preview before it crowds the editor, and stacks vertically at narrow widths without whole-page horizontal scrolling.

Previously, the content creation editor was locked to a fixed width, which forced whole-page horizontal scrolling and made the editor difficult to use in smaller desktop windows.

- Replace fixed page and panel widths with a fluid responsive layout.
- Collapse multi-column fields and preview panes into a vertical layout as the window narrows.
- Keep primary controls visible with a local or sticky toolbar where useful.
- Allow only inherently wide fields, such as raw JSON or code editors, to scroll within their own panel; the page itself should not require horizontal scrolling.
- Consider resizable editor and preview panes at larger window sizes.
- Test the editor at the app's minimum supported window size, including keyboard navigation and focus behavior.

## Simplify DM review export

**Status:** Implemented. **Export for DM** now creates one versioned `.azeroth-review.json` file containing the character, campaign profile, and readiness report. The former PDF/text/folder bundle has been removed.

The previous desktop export created a folder containing an importable JSON file, a PDF, and a readiness text report. That bundle was intended to support both app-based inspection and offline/manual review, but it was unnecessarily cumbersome when the DM was importing the character into the app.

- Make **Export for DM** save one `.azeroth-review.json` file through a normal save dialog.
- Keep all character data and useful readiness metadata inside that JSON so a separate text report is unnecessary.
- Import the JSON directly into the DM's read-only inspection view.
- Keep printable PDF export as its existing separate action instead of coupling it to DM handoff.
- Keep the JSON format versioned so future app releases can migrate older review files safely.

## Proposed implementation order

1. [x] Replace the folder-based DM review export with a single JSON file.
2. [x] Make the content creation editor responsive and eliminate whole-page horizontal scrolling.
3. [x] Add reusable collapsible panels and persisted expansion state to Guided Setup and Session-Zero Preflight.
4. [x] Restore the PDF export to the approved Warcraft-themed design and add rendered visual QA coverage.
5. [x] Extend collapsible panels to the remaining long management sections.
6. [x] Add favorites/pinning to the existing generated Actions dashboard.
7. [x] Build the persistent combat strip.
8. [x] Create the unified Encounter action library from existing action-generation data.
9. [ ] Add inline attack, spell, item, and feature resolution.
10. [x] Add action-economy filters and availability explanations.
11. [x] Add recent actions and one-step resource undo.
12. [ ] Consider the optional turn planner and command palette after real-session feedback.

## Initial success criteria

- A player can complete a typical attack or spell turn without changing tabs.
- HP, conditions, concentration, slots, and key resources remain visible while choosing an action.
- Attacks, spells, features, and items use one consistent interaction pattern.
- The detailed management screens remain available for preparation and editing.
- Common actions require no more than two clicks after opening the Encounter workspace.
- The layout remains usable at the app's smallest supported window size.
- Exported PDFs visually match the approved Warcraft-themed reference design.
- The content creation editor remains usable without whole-page horizontal scrolling at the minimum supported window size.
- A player can export a DM-readable character as one JSON file without creating a folder.
