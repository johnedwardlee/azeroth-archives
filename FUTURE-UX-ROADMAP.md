# Future UX Roadmap

This document records interface work to revisit after the pre-session character-creation rules are stable. It is planning material, not a commitment to the next release.

## Collapsible sections

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

Add a new default play screen called **Encounter**. It should combine the information needed to take a turn without replacing the detailed Actions, Combat, and Spells management screens.

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

## Proposed implementation order

1. Add reusable collapsible panels and persisted expansion state.
2. Add favorites/pinning to the existing generated Actions dashboard.
3. Build the persistent combat strip.
4. Create the unified Encounter action library from existing action-generation data.
5. Add inline attack, spell, item, and feature resolution.
6. Add action-economy filters and availability explanations.
7. Add recent actions and one-step resource undo.
8. Consider the optional turn planner and command palette after real-session feedback.

## Initial success criteria

- A player can complete a typical attack or spell turn without changing tabs.
- HP, conditions, concentration, slots, and key resources remain visible while choosing an action.
- Attacks, spells, features, and items use one consistent interaction pattern.
- The detailed management screens remain available for preparation and editing.
- Common actions require no more than two clicks after opening the Encounter workspace.
- The layout remains usable at the app's smallest supported window size.

