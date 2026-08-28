begin;

alter table public.characters add column if not exists unlinked_at timestamptz;

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
  v_code text := upper(trim(coalesce(p_invitation_code, '')));
  v_player_name text := trim(coalesce(p_player_name, ''));
begin
  if v_user_id is null then raise exception 'Authentication is required.'; end if;
  if length(v_player_name) not between 1 and 120 then raise exception 'Player name must contain between 1 and 120 characters.'; end if;
  if jsonb_typeof(p_character_state) <> 'object' then raise exception 'A complete character object is required.'; end if;

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
    insert into public.characters as existing (id, campaign_id, owner_user_id, state, updated_by, unlinked_at)
    values (
      p_character_id,
      v_invitation.campaign_id,
      v_user_id,
      (p_character_state - 'portraitDataUrl' - 'readOnlyReview' - 'reviewImportedAt')
        || jsonb_build_object('id', p_character_id::text),
      v_user_id,
      null
    )
    on conflict (id) do update
      set owner_user_id = excluded.owner_user_id,
          state = excluded.state,
          revision = existing.revision + 1,
          updated_by = excluded.updated_by,
          updated_at = now(),
          unlinked_at = null
      where existing.campaign_id = excluded.campaign_id
        and existing.unlinked_at is not null
    returning * into v_character;
    if not found then raise exception 'This character is already linked to a campaign.'; end if;
  else
    update public.characters character
    set owner_user_id = v_user_id, updated_by = v_user_id, updated_at = now(), unlinked_at = null
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

create or replace function public.apply_character_mutation(
  p_character_id uuid,
  p_mutation_id uuid,
  p_base_revision bigint,
  p_category text,
  p_patch jsonb
)
returns table (character_state jsonb, revision bigint, updated_at timestamptz, was_conflict boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_character public.characters%rowtype;
  v_existing public.character_mutations%rowtype;
  v_patch jsonb;
  v_conflict boolean;
  v_updated_at timestamptz := now();
begin
  if v_user_id is null then raise exception 'Authentication is required.'; end if;
  if p_base_revision < 0 then raise exception 'Base revision cannot be negative.'; end if;
  if p_category not in ('vitals', 'resource', 'inventory', 'spells', 'identity', 'advancement', 'combat', 'features', 'journal', 'companions', 'preferences', 'other') then raise exception 'Mutation category is invalid.'; end if;
  if jsonb_typeof(p_patch) <> 'object' then raise exception 'Mutation patch must be an object.'; end if;

  select character.* into v_character from public.characters character where character.id = p_character_id for update;
  if not found then raise exception 'Character was not found.'; end if;
  if v_character.unlinked_at is not null then raise exception 'Character is no longer linked to this campaign.'; end if;
  if v_character.owner_user_id <> v_user_id and not public.is_campaign_dm(v_character.campaign_id, v_user_id) then raise exception 'You do not have permission to edit this character.'; end if;

  select mutation.* into v_existing from public.character_mutations mutation where mutation.id = p_mutation_id;
  if found then
    return query select v_character.state, v_character.revision, v_character.updated_at, v_existing.was_conflict;
    return;
  end if;

  v_patch := p_patch - 'id' - 'portraitDataUrl' - 'readOnlyReview' - 'reviewImportedAt';
  v_conflict := p_base_revision <> v_character.revision;
  update public.characters character
  set state = (character.state || v_patch) || jsonb_build_object('updatedAt', to_jsonb(v_updated_at)), revision = character.revision + 1, updated_by = v_user_id, updated_at = v_updated_at
  where character.id = p_character_id returning * into v_character;

  insert into public.character_mutations (id, campaign_id, character_id, actor_user_id, category, patch, base_revision, applied_revision, was_conflict)
  values (p_mutation_id, v_character.campaign_id, v_character.id, v_user_id, p_category, v_patch, p_base_revision, v_character.revision, v_conflict);

  return query select v_character.state, v_character.revision, v_character.updated_at, v_conflict;
end;
$$;

create or replace function public.record_roll_event(
  p_event_id uuid,
  p_character_id uuid,
  p_actor_name text,
  p_category text,
  p_label text,
  p_formula text,
  p_dice jsonb,
  p_modifier integer,
  p_total integer,
  p_mode text default 'normal',
  p_detail text default '',
  p_hidden boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_character public.characters%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication is required.'; end if;
  select character.* into v_character from public.characters character where character.id = p_character_id;
  if not found then raise exception 'Character was not found.'; end if;
  if v_character.unlinked_at is not null then raise exception 'Character is no longer linked to this campaign.'; end if;
  if v_character.owner_user_id <> v_user_id and not public.is_campaign_dm(v_character.campaign_id, v_user_id) then raise exception 'You do not have permission to roll for this character.'; end if;
  if p_hidden and not public.is_campaign_dm(v_character.campaign_id, v_user_id) then raise exception 'Only the campaign DM can hide a roll.'; end if;
  if jsonb_typeof(p_dice) <> 'array' then raise exception 'Roll dice must be an array.'; end if;

  insert into public.roll_events (id, campaign_id, character_id, actor_user_id, actor_name, category, label, formula, dice, modifier, total, mode, detail, hidden)
  values (p_event_id, v_character.campaign_id, v_character.id, v_user_id, trim(p_actor_name), p_category, trim(p_label), coalesce(p_formula, ''), p_dice, p_modifier, p_total, p_mode, coalesce(p_detail, ''), p_hidden)
  on conflict (id) do nothing;
  return p_event_id;
end;
$$;

create or replace function public.unlink_campaign_character(
  p_campaign_id uuid,
  p_character_id uuid,
  p_delete_roll_history boolean default false
)
returns table (character_id uuid, owner_user_id uuid, deleted_roll_count bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_character public.characters%rowtype;
  v_deleted bigint := 0;
begin
  if v_user_id is null then raise exception 'Authentication is required.'; end if;
  select character.* into v_character
  from public.characters character
  where character.id = p_character_id and character.campaign_id = p_campaign_id
  for update;
  if not found or v_character.unlinked_at is not null then raise exception 'Linked character was not found.'; end if;
  if v_character.owner_user_id <> v_user_id and not public.is_campaign_dm(p_campaign_id, v_user_id) then raise exception 'Only the character owner or campaign DM can unlink this character.'; end if;

  if p_delete_roll_history then
    delete from public.roll_events event where event.campaign_id = p_campaign_id and event.character_id = p_character_id;
    get diagnostics v_deleted = row_count;
  end if;

  update public.characters character set unlinked_at = now(), updated_by = v_user_id, updated_at = now() where character.id = p_character_id;
  update public.campaign_members member set revoked_at = now()
  where member.campaign_id = p_campaign_id
    and member.user_id = v_character.owner_user_id
    and member.role = 'player'
    and not exists (
      select 1 from public.characters other
      where other.campaign_id = p_campaign_id
        and other.owner_user_id = v_character.owner_user_id
        and other.id <> p_character_id
        and other.unlinked_at is null
    );
  return query select v_character.id, v_character.owner_user_id, v_deleted;
end;
$$;

drop trigger if exists broadcast_character_link_changes on public.characters;
create trigger broadcast_character_link_changes
after insert or delete on public.characters
for each row execute function public.broadcast_campaign_change();

drop trigger if exists broadcast_character_unlink_changes on public.characters;
create trigger broadcast_character_unlink_changes
after update of unlinked_at on public.characters
for each row
when (old.unlinked_at is distinct from new.unlinked_at)
execute function public.broadcast_campaign_change();

revoke execute on function public.redeem_campaign_invitation(text, uuid, jsonb, text) from public, anon;
revoke execute on function public.apply_character_mutation(uuid, uuid, bigint, text, jsonb) from public, anon;
revoke execute on function public.record_roll_event(uuid, uuid, text, text, text, text, jsonb, integer, integer, text, text, boolean) from public, anon;
revoke execute on function public.unlink_campaign_character(uuid, uuid, boolean) from public, anon;
grant execute on function public.redeem_campaign_invitation(text, uuid, jsonb, text) to authenticated;
grant execute on function public.apply_character_mutation(uuid, uuid, bigint, text, jsonb) to authenticated;
grant execute on function public.record_roll_event(uuid, uuid, text, text, text, text, jsonb, integer, integer, text, text, boolean) to authenticated;
grant execute on function public.unlink_campaign_character(uuid, uuid, boolean) to authenticated;

commit;
