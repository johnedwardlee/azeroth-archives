begin;

-- Bind every character-specific invitation to the character selected by the player.
create or replace function public.redeem_campaign_invitation(
  p_invitation_code text,
  p_character_id uuid,
  p_character_state jsonb,
  p_player_name text
)
returns table (campaign_id uuid, character_id uuid, character_state jsonb, revision bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_invitation public.campaign_invitations%rowtype;
  v_character public.characters%rowtype;
  v_previous_owner uuid;
  v_code text := upper(trim(coalesce(p_invitation_code, '')));
  v_player_name text := trim(coalesce(p_player_name, ''));
begin
  if v_user_id is null then raise exception 'Authentication is required.'; end if;
  if p_character_id is null then raise exception 'Choose a saved character.'; end if;
  if length(v_player_name) not between 1 and 120 then raise exception 'Player name must contain between 1 and 120 characters.'; end if;
  if jsonb_typeof(p_character_state) is distinct from 'object' then raise exception 'A complete character object is required.'; end if;

  select invitation.* into v_invitation
  from public.campaign_invitations invitation
  where invitation.token_hash = encode(extensions.digest(v_code, 'sha256'), 'hex')
  for update;

  if not found then raise exception 'Invitation code is invalid.'; end if;
  if v_invitation.used_at is not null then raise exception 'Invitation code has already been used.'; end if;
  if v_invitation.expires_at <= now() then raise exception 'Invitation code has expired.'; end if;
  if v_invitation.character_id is not null and v_invitation.character_id <> p_character_id then
    raise exception 'This recovery code belongs to a different character.';
  end if;
  if public.is_campaign_dm(v_invitation.campaign_id, v_user_id) then
    raise exception 'Use a player installation to redeem this code, not the campaign DM account.';
  end if;

  insert into public.campaign_members (campaign_id, user_id, role, display_name, revoked_at)
  values (v_invitation.campaign_id, v_user_id, 'player', v_player_name, null)
  on conflict on constraint campaign_members_pkey do update
    set role = 'player', display_name = excluded.display_name, revoked_at = null, joined_at = now();

  if v_invitation.character_id is null then
    insert into public.characters as existing (id, campaign_id, owner_user_id, state, updated_by, unlinked_at)
    values (
      p_character_id, v_invitation.campaign_id, v_user_id,
      (p_character_state - 'portraitDataUrl' - 'readOnlyReview' - 'reviewImportedAt')
        || jsonb_build_object('id', p_character_id::text),
      v_user_id, null
    )
    on conflict (id) do update
      set owner_user_id = excluded.owner_user_id, state = excluded.state,
          revision = existing.revision + 1, updated_by = excluded.updated_by,
          updated_at = now(), unlinked_at = null
      where existing.campaign_id = excluded.campaign_id and existing.unlinked_at is not null
    returning * into v_character;
    if not found then raise exception 'This character is already linked to a campaign.'; end if;
  else
    select character.owner_user_id into v_previous_owner
    from public.characters character
    where character.id = v_invitation.character_id and character.campaign_id = v_invitation.campaign_id
    for update;
    if not found then raise exception 'The recovery character no longer exists.'; end if;

    update public.characters character
    set owner_user_id = v_user_id, updated_by = v_user_id, updated_at = now(), unlinked_at = null
    where character.id = v_invitation.character_id and character.campaign_id = v_invitation.campaign_id
    returning * into v_character;
    if not found then raise exception 'The recovery character no longer exists.'; end if;

    -- A superseded device keeps party access only if it still owns another sheet.
    if v_previous_owner <> v_user_id then
      update public.campaign_members member
      set revoked_at = now()
      where member.campaign_id = v_invitation.campaign_id and member.user_id = v_previous_owner
        and member.role = 'player' and member.revoked_at is null
        and not exists (
          select 1 from public.characters other
          where other.campaign_id = v_invitation.campaign_id and other.owner_user_id = v_previous_owner
            and other.unlinked_at is null
        );
    end if;
  end if;

  update public.campaign_invitations invitation
  set used_at = now(), used_by = v_user_id
  where invitation.id = v_invitation.id;

  return query select v_character.campaign_id, v_character.id, v_character.state, v_character.revision;
end;
$$;

-- Recovery must preserve the server sheet, not accidentally run the new-character path.
create or replace function public.recover_campaign_character(
  p_invitation_code text,
  p_character_id uuid,
  p_campaign_id uuid,
  p_player_name text
)
returns table (campaign_id uuid, character_id uuid, character_state jsonb, revision bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invitation public.campaign_invitations%rowtype;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Authentication is required.'; end if;
  if p_character_id is null or p_campaign_id is null then raise exception 'Choose a previously linked character.'; end if;

  select invitation.* into v_invitation
  from public.campaign_invitations invitation
  where invitation.token_hash = encode(extensions.digest(upper(trim(coalesce(p_invitation_code, ''))), 'sha256'), 'hex')
  for update;
  if not found then raise exception 'Recovery code is invalid.'; end if;
  if v_invitation.used_at is not null then raise exception 'Recovery code has already been used.'; end if;
  if v_invitation.expires_at <= now() then raise exception 'Recovery code has expired.'; end if;
  if v_invitation.character_id is null then raise exception 'Use a character-specific recovery code from the DM, not a new-player invitation.'; end if;
  if v_invitation.character_id <> p_character_id or v_invitation.campaign_id <> p_campaign_id then
    raise exception 'This recovery code belongs to a different character or campaign.';
  end if;

  perform 1
  from public.characters character
  where character.id = p_character_id and character.campaign_id = p_campaign_id
  for update;
  if not found then raise exception 'The recovery character no longer exists.'; end if;

  return query select recovered.* from public.redeem_campaign_invitation(
    p_invitation_code, p_character_id, '{}'::jsonb, p_player_name
  ) recovered;

end;
$$;

revoke execute on function public.redeem_campaign_invitation(text, uuid, jsonb, text) from public, anon;
grant execute on function public.redeem_campaign_invitation(text, uuid, jsonb, text) to authenticated;
revoke execute on function public.recover_campaign_character(text, uuid, uuid, text) from public, anon;
grant execute on function public.recover_campaign_character(text, uuid, uuid, text) to authenticated;

commit;
