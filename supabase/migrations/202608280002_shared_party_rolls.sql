begin;

alter table public.roll_events
add column if not exists hidden boolean not null default false;

drop policy if exists roll_events_dm_read on public.roll_events;
drop policy if exists roll_events_member_read on public.roll_events;
create policy roll_events_member_read
on public.roll_events for select to authenticated
using (public.is_campaign_member(campaign_id) and (not hidden or public.is_campaign_dm(campaign_id)));

create or replace function public.can_access_party_rolls_topic(p_topic text, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.campaign_members member
    where member.user_id = p_user_id
      and member.revoked_at is null
      and p_topic = 'party-rolls:' || member.campaign_id::text
  );
$$;

revoke execute on function public.can_access_party_rolls_topic(text, uuid) from public, anon;
grant execute on function public.can_access_party_rolls_topic(text, uuid) to authenticated;

drop policy if exists campaign_private_broadcast_read on realtime.messages;
create policy campaign_private_broadcast_read
on realtime.messages for select to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and (
    public.can_access_dm_campaign_topic((select realtime.topic()))
    or public.can_access_character_topic((select realtime.topic()))
    or public.can_access_party_rolls_topic((select realtime.topic()))
  )
);

drop function if exists public.record_roll_event(uuid, uuid, text, text, text, text, jsonb, integer, integer, text, text);
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
  if v_character.owner_user_id <> v_user_id and not public.is_campaign_dm(v_character.campaign_id, v_user_id) then
    raise exception 'You do not have permission to roll for this character.';
  end if;
  if p_hidden and not public.is_campaign_dm(v_character.campaign_id, v_user_id) then
    raise exception 'Only the campaign DM can hide a roll.';
  end if;
  if jsonb_typeof(p_dice) <> 'array' then raise exception 'Roll dice must be an array.'; end if;

  insert into public.roll_events (
    id, campaign_id, character_id, actor_user_id, actor_name, category,
    label, formula, dice, modifier, total, mode, detail, hidden
  ) values (
    p_event_id, v_character.campaign_id, v_character.id, v_user_id,
    trim(p_actor_name), p_category, trim(p_label), coalesce(p_formula, ''),
    p_dice, p_modifier, p_total, p_mode, coalesce(p_detail, ''), p_hidden
  ) on conflict (id) do nothing;

  return p_event_id;
end;
$$;

revoke execute on function public.record_roll_event(uuid, uuid, text, text, text, text, jsonb, integer, integer, text, text, boolean) from public, anon;
grant execute on function public.record_roll_event(uuid, uuid, text, text, text, text, jsonb, integer, integer, text, text, boolean) to authenticated;

drop trigger if exists broadcast_roll_events on public.roll_events;
create or replace function public.broadcast_roll_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign_id uuid := coalesce(new.campaign_id, old.campaign_id);
  v_hidden boolean := coalesce(new.hidden, old.hidden, false);
begin
  perform realtime.broadcast_changes(
    'campaign:' || v_campaign_id::text,
    tg_op,
    tg_op,
    tg_table_name,
    tg_table_schema,
    new,
    old
  );
  if not v_hidden then
    perform realtime.broadcast_changes(
      'party-rolls:' || v_campaign_id::text,
      tg_op,
      tg_op,
      tg_table_name,
      tg_table_schema,
      new,
      old
    );
  end if;
  return null;
end;
$$;

create trigger broadcast_roll_events
after insert or delete on public.roll_events
for each row execute function public.broadcast_roll_event();

commit;
