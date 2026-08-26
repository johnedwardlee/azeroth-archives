# Live Sync Deployment Setup

The application code is ready to remain fully offline when no service is configured. A v2.0 live-sync build requires one Supabase project and two GitHub Actions secrets. The publishable key is intentionally safe to embed in a desktop application; never use a Supabase secret or service-role key here.

## 1. Create the Supabase project

1. Create a Supabase project in the region nearest the group.
2. In Authentication, enable Email sign-in and Anonymous sign-ins.
3. In Authentication URL configuration, add this redirect URL exactly:

   `azeroth-archives://auth-callback`

4. Keep leaked-password protection and the normal email rate limits enabled. CAPTCHA is optional for the initial private beta but should be enabled if invitation abuse appears.

## 2. Install the database migration

1. Open the Supabase SQL editor.
2. Copy the complete contents of `supabase/migrations/202608240001_live_sync.sql` into a new query.
3. Run it once and confirm the transaction succeeds.
4. Do not expose table write grants or add a service-role key to the app. All writes intentionally pass through the migration's authenticated RPC functions.

The migration creates the campaign, membership, invitation, character, mutation-audit, and roll-event tables; enables row-level security; authorizes private campaign Realtime channels; and enforces the 30-day/500-roll retention policy.

### Existing v2.0 beta projects

If the original migration was installed before `v2.0.0-beta.3`, run `supabase/migrations/202608250001_fix_invitation_redemption.sql` once in the Supabase SQL editor. This replaces the invitation-redemption function without deleting campaigns, invitations, characters, or user accounts. New projects using the updated original migration do not need the follow-up migration.

## 3. Configure GitHub release builds

In the GitHub repository, open **Settings → Secrets and variables → Actions** and create these repository secrets:

- `AZEROTH_SUPABASE_URL`: the project URL, such as `https://project-ref.supabase.co`
- `AZEROTH_SUPABASE_PUBLISHABLE_KEY`: the project's publishable key (`sb_publishable_...`) or legacy anon key

The release workflow passes these values only to the Windows packaging step. `scripts/generate-sync-config.cjs` embeds them into the installer. Ordinary local and CI builds remain deliberately unconfigured unless both environment variables are set.

## 4. Pre-release verification

Use a prerelease tag and at least three Windows installations or profiles: one DM and two players.

1. DM signs in by email, creates a campaign, and generates two invitations.
2. Each player links a different existing local character.
3. Confirm the DM sees both characters and their presence state.
4. Make simultaneous changes to different fields and verify neither is lost.
5. Disconnect one player, make several changes and rolls, reconnect, and verify the queued events arrive once.
6. Confirm the DM can add items/spells and increase or reduce current resources without full editing.
7. Confirm identity, class, maximum-value, removal, and advancement changes remain blocked until full editing is enabled.
8. Switch characters and return to Party; confirm the full-edit toggle resets.
9. Verify a player cannot read another player's character or the campaign roll table using the Supabase API explorer.
10. Revoke a test player and confirm subsequent reads and writes fail.

Do not promote the build from beta until the migration and these multi-client checks pass against the actual hosted project.
