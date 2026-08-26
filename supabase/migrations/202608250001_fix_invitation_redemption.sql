begin;

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
  v_code text := upper(trim(coalesce(p_invitation_code, ''));
  v_player_name text := trim(coalesce(p_player_name, ''));
begin
  if v_user_id is null then
    raise exception 'Authentication is required.';
  end if;
  if length(v_player_name) not between 1 and 120 then
    raise exception 'Player name must contain between 1 and 120 characters.';
  end if;
  if jsonb_typeof(p_character_state) <> 'object' then
    raise exception 'A complete character object is required.';
  end if;

  select invitation.* into v_invitation
  from public.campaign_invitations invitation
  where invitation.token_hash = encode(extensions.digest(v_code, 'sha256'), 'hex')
  for update;

  if not found then raise exception 'Invitation code is invalid.'; end if;
  if v_invitation.used_at is not null then raise exception 'Invitation code has already been used.'; end if;
  if v_invitation.expires_at <= now() then raise exception 'Invitation code has expired.'; end if;

  insert into public.campaign_members (campaign_id, user_id, role, display_name, revoked_at)
  values (v_invitation.campaign_id, v_user_id, 'player', v_player_name, null)
  on conflict on constraint campaign_members_pkey do update
    set role = 'player', display_name = excluded.display_name, revoked_at = null, joined_at = now();

  if v_invitation.character_id is null then
    insert into public.characters (id, campaign_id, owner_user_id, state, updated_by)
    values (
      p_character_id,
      v_invitation.campaign_id,
      v_user_id,
      (p_character_state - 'portraitDataUrl' - 'readOnlyReview' - 'reviewImportedAt')
        || jsonb_build_object('id', p_character_id::text),
      v_user_id
    )
    returning * into v_character;
  else
    update public.characters character
    set owner_user_id = v_user_id, updated_by = v_user_id, updated_at = now()
    where character.id = v_invitation.character_id
      and character.campaign_id = v_invitation.campaign_id
    returning * into v_character;
    if not found then raise exception 'The recovery character no longer exists.'; end if;
  end if;

  update public.campaign_invitations invitation
  set used_at = now(), used_by = v_user_id
  where invitation.id = v_invitation.id;

  return query select v_character.campaign_id, v_character.id, v_character.state, v_character.revision;
end;
$$;

revoke execute on function public.redeem_campaign_invitation(text, uuid, jsonb, text) from public, anon;
grant execute on function public.redeem_campaign_invitation(text, uuid, jsonb, text) to authenticated;

commit;
