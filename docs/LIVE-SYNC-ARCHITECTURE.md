# Azeroth Archives Live Sync Architecture

Status: Approved for implementation on 2026-08-24.

## Scope

Version 2.0 adds opt-in, offline-first synchronization between player installations and a DM installation. A linked player character remains usable and recoverable locally. Supabase stores the canonical shared snapshot, serializes mutations, broadcasts live changes, and retains a short roll history.

Included:

- DM email magic-link authentication.
- Device-bound anonymous player authentication.
- Single-use, expiring campaign invitation codes.
- One player-owned character per redeemed invitation.
- Live character state, private campaign presence, reconnect handling, and an offline mutation outbox.
- A DM Party workspace with party summaries, live character inspection, controlled editing, and a centralized roll feed.
- The approved DM permission model below.
- The latest 500 roll events per campaign, with a maximum age of 30 days.

Excluded unless separately approved:

- Initiative and encounter-order tracking.
- Enemy stat blocks, damage targeting, maps, tokens, or VTT behavior.
- Hidden rolls, chat, external notifications, or player-to-player character visibility.
- Campaign content-pack distribution or remote level-up approval.

## Trust boundaries

The existing `appRole` preference is presentation state only. It must never authorize remote data. Supabase Auth supplies the actor identity, and PostgreSQL Row Level Security plus security-definer RPC functions enforce campaign membership and ownership.

- A permanent authenticated user can create and administer campaigns as DM.
- An anonymous authenticated user can redeem one invitation and operate only characters it owns.
- The publishable Supabase key can be packaged with the application.
- The Supabase service-role key must never be packaged, committed, logged, or sent to the renderer.
- Refresh tokens are encrypted through Electron `safeStorage` before being written under the application data directory.
- The renderer reaches synchronization through the narrow preload API. It does not receive filesystem access or administrative credentials.
- Production network requests remain deny-by-default and are restricted to GitHub update hosts plus the configured Supabase HTTPS and WSS hosts.
- Campaign-wide mutation and roll broadcasts are readable only by the campaign DM. Each player subscribes to a separate owner-authorized character channel for changes to their own character, preventing player-to-player mutation visibility even through Realtime.

## Data model

`campaigns`

- Campaign identity, name, DM owner, and timestamps.

`campaign_members`

- Auth user membership, role, display name, join time, and revocation state.

`campaign_invitations`

- A hash of a single-use invitation token, expiry, creator, redemption identity, and redemption time. Plain invitation codes are returned only once.

`characters`

- The linked character ID, campaign, owner, JSON character snapshot, monotonically increasing revision, last actor, and timestamps. Portrait data is excluded from mutation broadcasts and will be stored separately when remote portrait support is implemented.

`character_mutations`

- Idempotency key, actor, mutation category, base and applied revisions, conflict marker, shallow JSON patch, and creation time. This is also the DM/player change audit trail.

`roll_events`

- Character, actor, category, label, formula, individual dice, modifier, total, roll mode, optional detail, and timestamp.

## Mutation protocol

The application must not repeatedly upload an entire character. `patchCharacter` already identifies top-level character fields that changed; live sync converts those patches into mutation envelopes:

```ts
type CharacterMutation = {
  id: string;
  campaignId: string;
  characterId: string;
  baseRevision: number;
  category: MutationCategory;
  patch: Partial<CharacterData>;
  createdAt: string;
};
```

The database RPC locks the character row, verifies that the actor is the owner or campaign DM, ignores duplicate mutation IDs, shallow-merges the patch, increments the revision, records whether the submitted base revision was stale, and broadcasts the updated row. Independent top-level domains therefore do not overwrite one another. When two mutations replace the same top-level domain, server application order is authoritative.

The local outbox is persisted beside the existing offline store. A mutation is removed only after the server acknowledges its ID. On reconnect the client fetches the newest snapshot, replays queued mutations in creation order, and then subscribes to the private campaign channel.

Remote snapshots are normalized and validated before replacing local state. Invalid or newer-schema snapshots are rejected without damaging the local character.

## DM permission model

The database authorizes the campaign DM to mutate any linked character. The edit toggle is an application safety mechanism that prevents accidental broad changes.

| DM action | Full edit toggle required |
| --- | --- |
| View any synchronized character data | No |
| Add an inventory item | No |
| Add a known spell | No |
| Restore or increase HP, spell slots, hit dice, class resources, charges, or ammunition | No |
| Spend or reduce HP, spell slots, hit dice, class resources, charges, or ammunition | No |
| Change identity, ancestry, class, background, abilities, maximum values, features, or advancement | Yes |
| Remove items or spells | Yes |
| Change prepared, equipped, attuned, or creation-choice state | Yes |
| Delete or unlink a character | Separate confirmation |

The edit toggle is per character and resets when the DM switches characters, closes the detail view, or restarts the app. Every successful remote change retains actor and mutation metadata. Players receive an in-app notice for DM-originated changes.

## Roll protocol

Every dice-producing UI calls one shared roll-event publisher after resolving locally. Network failure never prevents a local roll. The event is queued and published when connectivity returns.

Covered roll sources:

- Initiative, attacks, spell attacks, ability checks, and saving throws.
- Damage, healing, hit dice, and concentration checks.
- Encounter and Spellbook rolls.

The DM roll feed receives insert broadcasts and also fetches recent events when opening or reconnecting. The database retains at most 500 events per campaign and removes events older than 30 days.

## UI contract

Player installations gain a compact connection control showing Unlinked, Connecting, Live, Offline changes pending, or Sync error. Linking always requires an explicit choice of a local character and never silently publishes the local library.

DM installations gain a primary Party tab containing:

- Party cards with identity, class/level, HP, temporary HP, Armor Class, speed, conditions, exhaustion, concentration, inspiration, encumbrance, key resources, presence, and last update.
- A chronological roll feed showing actor, action, formula, individual dice, modifiers, mode, total, and time.
- Live character detail using the existing Encounter, Character, Spellbook, Inventory, Companions, and Journal surfaces.
- A clearly visible per-character full-edit toggle and the approved always-available mutation controls.

## Backward compatibility

- Synchronization is opt-in. Existing offline characters and libraries continue to work without Supabase configuration or an internet connection.
- JSON character backups, full-library backups, DM review exports, and PDFs remain available.
- Importing a DM review does not automatically link it.
- Store migrations add sync metadata and outboxes without changing character IDs or deleting local data.
- Unlinking removes the remote relationship, not the local character.

## Release gates

- Unit tests for mutation categorization, DM toggle policy, idempotency, queue replay, roll serialization, and snapshot validation.
- SQL/RLS tests proving cross-campaign and cross-player access is denied.
- Electron tests for encrypted session persistence and the network allowlist.
- Multi-client tests with one DM and at least two player sessions.
- Disconnect, reconnect, duplicate delivery, stale revision, revoked membership, reinstall/reinvite, backup, migration, update, and rollback tests.
- `v2.0.0-beta.1` through `beta.4`: authentication, linking, synchronization, permissions, and reconnect hardening.
- `v2.0.0-beta.5` and `beta.6`: DM controls, shared rolls, spell and item roll fixes, and campaign roll administration.
- `v2.0.0-beta.7` and `beta.8`: party-wide visible rolls, hidden DM rolls, journal coalescing, conditions, concentration, Initiative, and final Encounter layout.
- `v2.0.0`: stable release after the complete DM-and-two-player hosted verification checklist passed.
