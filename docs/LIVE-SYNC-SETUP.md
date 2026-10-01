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

The migration creates the campaign, membership, invitation, character, mutation-audit, and roll-event tables; enables row-level security; authorizes private campaign and party-roll Realtime channels; protects hidden DM rolls; and enforces the 30-day/500-roll retention policy. This baseline is consolidated through `v2.0.1`. After installing it, also apply `supabase/migrations/202610010001_connection_recovery.sql` for the connection-recovery hotfix.

### Upgrade an existing v2.0 beta project

Do not rerun the consolidated baseline against an existing beta database. Apply only the follow-up files that have not already succeeded, in this order. This table covers upgrades through v2.0.1; then apply the connection-recovery hotfix described below:

| Existing database state | Required follow-up migrations |
| --- | --- |
| Created before `v2.0.0-beta.3` | `202608250001_fix_invitation_redemption.sql`, `202608280001_clear_campaign_rolls.sql`, `202608280002_shared_party_rolls.sql`, `202608280003_character_unlink.sql` |
| Created on beta.3 through beta.5 | `202608280001_clear_campaign_rolls.sql`, `202608280002_shared_party_rolls.sql`, `202608280003_character_unlink.sql` |
| Created on beta.6 | `202608280002_shared_party_rolls.sql`, `202608280003_character_unlink.sql` |
| Created on beta.7, beta.8, or stable `v2.0.0` | `202608280003_character_unlink.sql` |
| Created from the consolidated `v2.0.1` baseline | None |

The follow-ups replace functions and policies without deleting campaigns, invitations, characters, accounts, or existing roll history. The shared-roll migration lets players receive visible party rolls while keeping hidden DM rolls protected. The character-unlink migration adds a confirmed archive operation; existing roll history is retained unless the player or DM explicitly chooses to delete it.

### Connection-recovery hotfix (v2.0.4)

Every existing project needs `supabase/migrations/202610010001_connection_recovery.sql` before distributing the recovery-enabled app. Run its complete contents in the Supabase SQL editor. It validates character and campaign scope, preserves the shared sheet, keeps the invitation single-use and time-limited, and revokes the superseded device's membership only when that identity owns no other active character in the campaign. It does not delete sheets or rolls. Older clients can still use ordinary invitations.

To restore a player's lost device login:

1. On the DM installation, open **Live sync**, select the existing campaign, and find the player under **Linked on this device**.
2. Click **Generate recovery code** for that specific character. Share the code privately with that player; it expires after 72 hours.
3. On the updated player installation, open **Live sync** and choose **Recover connection**. Select the previously linked character, confirm the player name, and enter the recovery code.
4. Click **Recover connection**. The original server character is restored to the device, its portrait stays local, and queued offline changes replay when the connection becomes live.
5. Confirm both sides receive a small resource change and that previous party rolls remain visible.

Do not unlink, duplicate, or create a replacement character as a recovery workaround. A normal new-player invitation cannot be used in the recovery form. A code for a different character or campaign fails before changing ownership or consuming the code.

Hosted checks for this hotfix: restart each app while signed in; start a player offline and reconnect without losing its identity; complete DM magic-link sign-in without a mode switch; recover a test player's expired/missing session; reject wrong-character, wrong-campaign, expired, reused, and ordinary invitation codes; verify queued edits and rolls replay once; verify the old device loses access to the recovered sheet. Local unit tests cover the client behavior and SQL security contracts, but do not replace hosted verification of the migration.

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
