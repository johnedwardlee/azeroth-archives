begin;

-- A character-specific code is the authority when local copies have new IDs.
-- Preview discloses only confirmation metadata; it never consumes the code.
create or replace function public.preview_campaign_recovery(p_invitation_code text)
returns table (campaign_id uuid, campaign_name text, character_id uuid, character_name text, player_name text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_invitation public.campaign_invitations%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication is required.'; end if;
  select invitation.* into v_invitation
  from public.campaign_invitations invitation
  where invitation.token_hash = encode(extensions.digest(upper(trim(coalesce(p_invitation_code, ''))), 'sha256'), 'hex');
  if not found then raise exception 'Recovery code is invalid.'; end if;
  if v_invitation.used_at is not null then raise exception 'Recovery code has already been used.'; end if;
  if v_invitation.expires_at <= now() then raise exception 'Recovery code has expired.'; end if;
  if v_invitation.character_id is null then raise exception 'This is a new-player invitation. Use Link another character, not recovery.'; end if;
  if public.is_campaign_dm(v_invitation.campaign_id, v_user_id) then
    raise exception 'Use a player installation to redeem this code, not the campaign DM account.';
  end if;
  return query select campaign.id, campaign.name, character.id,
    coalesce(nullif(character.state->>'name', ''), 'Unnamed character'),
    coalesce(character.state->>'playerName', ''), v_invitation.expires_at
  from public.characters character
  join public.campaigns campaign on campaign.id = character.campaign_id
  where character.id = v_invitation.character_id and character.campaign_id = v_invitation.campaign_id;
  if not found then raise exception 'The recovery character no longer exists.'; end if;
end;
$$;

-- The user confirms the previewed IDs. The locked existing recovery routine
-- validates that the code still matches those IDs and preserves server state.
create or replace function public.recover_campaign_character_from_code(
  p_invitation_code text, p_expected_character_id uuid, p_expected_campaign_id uuid, p_player_name text
)
returns table (campaign_id uuid, character_id uuid, character_state jsonb, revision bigint)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authentication is required.'; end if;
  if p_expected_character_id is null or p_expected_campaign_id is null then
    raise exception 'Check the recovery code and confirm its character first.';
  end if;
  return query select recovered.* from public.recover_campaign_character(
    p_invitation_code, p_expected_character_id, p_expected_campaign_id, p_player_name
  ) recovered;
end;
$$;

revoke execute on function public.preview_campaign_recovery(text) from public, anon;
grant execute on function public.preview_campaign_recovery(text) to authenticated;
revoke execute on function public.recover_campaign_character_from_code(text, uuid, uuid, text) from public, anon;
grant execute on function public.recover_campaign_character_from_code(text, uuid, uuid, text) to authenticated;

commit;
