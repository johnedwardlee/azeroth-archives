# Live Sync Deployment Setup

The application code is ready to remain fully offline when no service is configured. A v2.0 live-sync build requires one Supabase project and two GitHub Actions secrets. The publishable key is intentionally safe to embed in a desktop application; never use a Supabase secret or service-role key here.

## 1. Create the Supabase project

1. Create a Supabase project in the region nearest the group.
2. In Authentication, enable Email sign-in and Anonymous sign-ins.
3. In Authentication URL configuration, add this redirect URL exactly:

   `azeroth-archives://auth-callback`

4. Keep leaked-password protection and the normal email rate limits enabled. CAPTCHA is optional for a private table, but should be enabled if invitation or sign-in abuse appears.

## 2. Install the database migration

1. Open the Supabase SQL editor.
2. Copy the complete contents of `supabase/migrations/202608240001_live_sync.sql` into a new query.
3. Run it once and confirm the transaction succeeds.
4. Do not expose table write grants or add a service-role key to the app. All writes intentionally pass through the migration's authenticated RPC functions.

The migration creates the campaign, membership, invitation, character, mutation-audit, and roll-event tables; enables row-level security; authorizes private campaign and party-roll Realtime channels; protects hidden DM rolls; and enforces the 30-day/500-roll retention policy. This baseline is consolidated through `v2.0.1`; a new project runs only this file.

### Upgrade an existing v2.0 beta project

Do not rerun the consolidated baseline against an existing beta database. Apply only the follow-up files that have not already succeeded, in this order:

| Existing database state | Required follow-up migrations |
| --- | --- |
| Created before `v2.0.0-beta.3` | `202608250001_fix_invitation_redemption.sql`, `202608280001_clear_campaign_rolls.sql`, `202608280002_shared_party_rolls.sql`, `202608280003_character_unlink.sql` |
| Created on beta.3 through beta.5 | `202608280001_clear_campaign_rolls.sql`, `202608280002_shared_party_rolls.sql`, `202608280003_character_unlink.sql` |
| Created on beta.6 | `202608280002_shared_party_rolls.sql`, `202608280003_character_unlink.sql` |
| Created on beta.7, beta.8, or stable `v2.0.0` | `202608280003_character_unlink.sql` |
| Created from the consolidated `v2.0.1` baseline | None |

The follow-ups replace functions and policies without deleting campaigns, invitations, characters, accounts, or existing roll history. The shared-roll migration lets players receive visible party rolls while keeping hidden DM rolls protected. The character-unlink migration adds a confirmed archive operation; existing roll history is retained unless the player or DM explicitly chooses to delete it.

## 3. Configure GitHub release builds

In the GitHub repository, open **Settings → Secrets and variables → Actions** and create these repository secrets:

- `AZEROTH_SUPABASE_URL`: the project URL, such as `https://project-ref.supabase.co`
- `AZEROTH_SUPABASE_PUBLISHABLE_KEY`: the project's publishable key (`sb_publishable_...`) or legacy anon key

The release workflow passes these values only to the Windows packaging step. `scripts/generate-sync-config.cjs` embeds them into the installer. Ordinary local and CI builds remain deliberately unconfigured unless both environment variables are set.

## 4. Release verification

Use a prerelease tag and at least three Windows installations or profiles: one DM and two players.

1. DM signs in by email, creates a campaign, and generates two invitations.
2. Each player links a different existing local character.
3. Confirm the DM sees both characters and their presence state.
4. Make simultaneous changes to different fields and verify neither is lost.
5. Disconnect one player, make several changes and rolls, reconnect, and verify the queued events arrive once.
6. Confirm the DM can add items/spells and increase or reduce current resources without full editing.
7. Confirm identity, class, maximum-value, removal, and advancement changes remain blocked until full editing is enabled.
8. Switch characters and return to Party; confirm the full-edit toggle resets.
9. Roll from each player's Encounter workspace and confirm both players and the DM see the visible results in real time.
10. Make a hidden DM roll and confirm it appears only in the DM feed, including after every app restarts.
11. Verify a player cannot read another player's character or any hidden roll using the Supabase API explorer.
12. Revoke a test player and confirm subsequent reads and writes fail.

Complete these checks against the actual hosted project before each stable release that changes Live Sync behavior.
