begin;

create extension if not exists pgcrypto with schema extensions;

create table public.campaigns (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  dm_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.campaign_members (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('dm', 'player')),
  display_name text not null check (length(trim(display_name)) between 1 and 120),
  joined_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (campaign_id, user_id)
);

create table public.characters (
  id uuid primary key,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  revision bigint not null default 1 check (revision > 0),
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, id)
);

create table public.campaign_invitations (
  id uuid primary key default extensions.gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  character_id uuid references public.characters(id) on delete cascade,
  token_hash text not null unique,
  created_by uuid not null references auth.users(id) on delete restrict,
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.character_mutations (
  id uuid primary key,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  category text not null check (category in (
    'vitals', 'resource', 'inventory', 'spells', 'identity', 'advancement',
    'combat', 'features', 'journal', 'companions', 'preferences', 'other'
  )),
  patch jsonb not null check (jsonb_typeof(patch) = 'object'),
  base_revision bigint not null check (base_revision >= 0),
  applied_revision bigint not null check (applied_revision > 0),
  was_conflict boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.roll_events (
  id uuid primary key,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  actor_name text not null check (length(trim(actor_name)) between 1 and 120),
  category text not null check (category in (
    'initiative', 'attack', 'spell-attack', 'check', 'save', 'damage',
    'healing', 'hit-dice', 'concentration', 'other'
  )),
  label text not null check (length(trim(label)) between 1 and 240),
  formula text not null default '',
  dice jsonb not null default '[]'::jsonb check (jsonb_typeof(dice) = 'array'),
  modifier integer not null default 0 check (modifier between -999 and 999),
  total integer not null check (total between -999999 and 999999),
  mode text not null default 'normal' check (mode in ('normal', 'advantage', 'disadvantage')),
  detail text not null default '',
  created_at timestamptz not null default now()
);

create index campaign_members_user_idx on public.campaign_members(user_id) where revoked_at is null;
create index characters_campaign_updated_idx on public.characters(campaign_id, updated_at desc);
create index characters_owner_idx on public.characters(owner_user_id);
create index character_mutations_character_idx on public.character_mutations(character_id, applied_revision desc);
create index character_mutations_campaign_created_idx on public.character_mutations(campaign_id, created_at desc);
create index roll_events_campaign_created_idx on public.roll_events(campaign_id, created_at desc);

alter table public.campaigns enable row level security;
alter table public.campaign_members enable row level security;
alter table public.characters enable row level security;
alter table public.campaign_invitations enable row level security;
alter table public.character_mutations enable row level security;
alter table public.roll_events enable row level security;

revoke all on public.campaigns from anon, authenticated;
revoke all on public.campaign_members from anon, authenticated;
revoke all on public.characters from anon, authenticated;
revoke all on public.campaign_invitations from anon, authenticated;
revoke all on public.character_mutations from anon, authenticated;
revoke all on public.roll_events from anon, authenticated;

grant select on public.campaigns to authenticated;
grant select on public.campaign_members to authenticated;
grant select on public.characters to authenticated;
grant select on public.character_mutations to authenticated;
grant select on public.roll_events to authenticated;

create or replace function public.is_campaign_member(p_campaign_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.campaign_members member
    where member.campaign_id = p_campaign_id
      and member.user_id = p_user_id
      and member.revoked_at is null
  );
$$;

create or replace function public.is_campaign_dm(p_campaign_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.campaign_members member
    where member.campaign_id = p_campaign_id
      and member.user_id = p_user_id
      and member.role = 'dm'
      and member.revoked_at is null
  );
$$;

create or replace function public.can_access_campaign_topic(p_topic text, p_user_id uuid default auth.uid())
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
      and p_topic = 'campaign:' || member.campaign_id::text
  );
$$;

create or replace function public.can_access_character_topic(p_topic text, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.characters character
    join public.campaign_members member on member.campaign_id = character.campaign_id
    where member.user_id = p_user_id
      and member.revoked_at is null
      and (character.owner_user_id = p_user_id or member.role = 'dm')
      and p_topic = 'character:' || character.id::text
  );
$$;

create or replace function public.can_access_dm_campaign_topic(p_topic text, p_user_id uuid default auth.uid())
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
      and member.role = 'dm'
      and member.revoked_at is null
      and p_topic = 'campaign:' || member.campaign_id::text
  );
$$;

revoke execute on function public.is_campaign_member(uuid, uuid) from public, anon;
revoke execute on function public.is_campaign_dm(uuid, uuid) from public, anon;
revoke execute on function public.can_access_campaign_topic(text, uuid) from public, anon;
revoke execute on function public.can_access_character_topic(text, uuid) from public, anon;
revoke execute on function public.can_access_dm_campaign_topic(text, uuid) from public, anon;
grant execute on function public.is_campaign_member(uuid, uuid) to authenticated;
grant execute on function public.is_campaign_dm(uuid, uuid) to authenticated;
grant execute on function public.can_access_campaign_topic(text, uuid) to authenticated;
grant execute on function public.can_access_character_topic(text, uuid) to authenticated;
grant execute on function public.can_access_dm_campaign_topic(text, uuid) to authenticated;

create policy campaigns_member_read
on public.campaigns for select to authenticated
using (public.is_campaign_member(id));

create policy campaign_members_self_or_dm_read
on public.campaign_members for select to authenticated
using (user_id = auth.uid() or public.is_campaign_dm(campaign_id));

create policy characters_owner_or_dm_read
on public.characters for select to authenticated
using (owner_user_id = auth.uid() or public.is_campaign_dm(campaign_id));

create policy character_mutations_owner_or_dm_read
on public.character_mutations for select to authenticated
using (
  public.is_campaign_dm(campaign_id)
  or exists (
    select 1
    from public.characters character
    where character.id = character_id
      and character.owner_user_id = auth.uid()
  )
);

create policy roll_events_dm_read
on public.roll_events for select to authenticated
using (public.is_campaign_dm(campaign_id));

create policy campaign_private_broadcast_read
on realtime.messages for select to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and (
    public.can_access_dm_campaign_topic((select realtime.topic()))
    or public.can_access_character_topic((select realtime.topic()))
  )
);

create policy campaign_private_presence_read
on realtime.messages for select to authenticated
using (
  realtime.messages.extension = 'presence'
  and public.can_access_campaign_topic((select realtime.topic()))
);

create policy campaign_private_presence_write
on realtime.messages for insert to authenticated
with check (
  realtime.messages.extension = 'presence'
  and public.can_access_campaign_topic((select realtime.topic()))
);

create or replace function public.create_campaign(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign_id uuid;
  v_user_id uuid := auth.uid();
  v_is_anonymous boolean := coalesce((auth.jwt() ->> 'is_anonymous')::boolean, true);
begin
  if v_user_id is null then
    raise exception 'Authentication is required.';
  end if;
  if v_is_anonymous then
    raise exception 'A permanent DM account is required to create a campaign.';
  end if;
  if length(trim(coalesce(p_name, ''))) not between 1 and 120 then
    raise exception 'Campaign name must contain between 1 and 120 characters.';
  end if;

  insert into public.campaigns (name, dm_user_id)
  values (trim(p_name), v_user_id)
  returning id into v_campaign_id;

  insert into public.campaign_members (campaign_id, user_id, role, display_name)
  values (v_campaign_id, v_user_id, 'dm', 'Dungeon Master');

  return v_campaign_id;
end;
$$;

create or replace function public.create_campaign_invitation(
  p_campaign_id uuid,
  p_character_id uuid default null,
  p_valid_hours integer default 72
)
returns table (invitation_id uuid, invitation_code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_invitation_id uuid := extensions.gen_random_uuid();
  v_raw text := upper(encode(extensions.gen_random_bytes(12), 'hex'));
  v_code text;
  v_expires_at timestamptz;
begin
  if not public.is_campaign_dm(p_campaign_id, v_user_id) then
    raise exception 'Only the campaign DM can create invitations.';
  end if;
  if p_valid_hours not between 1 and 168 then
    raise exception 'Invitation lifetime must be between 1 and 168 hours.';
  end if;
  if p_character_id is not null and not exists (
    select 1 from public.characters character
    where character.id = p_character_id and character.campaign_id = p_campaign_id
  ) then
    raise exception 'The recovery character does not belong to this campaign.';
  end if;

  v_code := substr(v_raw, 1, 6) || '-' || substr(v_raw, 7, 6) || '-' || substr(v_raw, 13, 6) || '-' || substr(v_raw, 19, 6);
  v_expires_at := now() + make_interval(hours => p_valid_hours);

  insert into public.campaign_invitations (
    id, campaign_id, character_id, token_hash, created_by, expires_at
  ) values (
    v_invitation_id,
    p_campaign_id,
    p_character_id,
    encode(extensions.digest(v_code, 'sha256'), 'hex'),
    v_user_id,
    v_expires_at
  );

  return query select v_invitation_id, v_code, v_expires_at;
end;
$$;

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
  if p_category not in (
    'vitals', 'resource', 'inventory', 'spells', 'identity', 'advancement',
    'combat', 'features', 'journal', 'companions', 'preferences', 'other'
  ) then raise exception 'Mutation category is invalid.'; end if;
  if jsonb_typeof(p_patch) <> 'object' then raise exception 'Mutation patch must be an object.'; end if;

  select character.* into v_character
  from public.characters character
  where character.id = p_character_id
  for update;
  if not found then raise exception 'Character was not found.'; end if;
  if v_character.owner_user_id <> v_user_id and not public.is_campaign_dm(v_character.campaign_id, v_user_id) then
    raise exception 'You do not have permission to edit this character.';
  end if;

  select mutation.* into v_existing
  from public.character_mutations mutation
  where mutation.id = p_mutation_id;
  if found then
    return query
      select v_character.state, v_character.revision, v_character.updated_at, v_existing.was_conflict;
    return;
  end if;

  v_patch := p_patch - 'id' - 'portraitDataUrl' - 'readOnlyReview' - 'reviewImportedAt';
  v_conflict := p_base_revision <> v_character.revision;

  update public.characters character
  set state = (character.state || v_patch) || jsonb_build_object('updatedAt', to_jsonb(v_updated_at)),
      revision = character.revision + 1,
      updated_by = v_user_id,
      updated_at = v_updated_at
  where character.id = p_character_id
  returning * into v_character;

  insert into public.character_mutations (
    id, campaign_id, character_id, actor_user_id, category, patch,
    base_revision, applied_revision, was_conflict
  ) values (
    p_mutation_id, v_character.campaign_id, v_character.id, v_user_id, p_category,
    v_patch, p_base_revision, v_character.revision, v_conflict
  );

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
  p_detail text default ''
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
  if jsonb_typeof(p_dice) <> 'array' then raise exception 'Roll dice must be an array.'; end if;

  insert into public.roll_events (
    id, campaign_id, character_id, actor_user_id, actor_name, category,
    label, formula, dice, modifier, total, mode, detail
  ) values (
    p_event_id, v_character.campaign_id, v_character.id, v_user_id,
    trim(p_actor_name), p_category, trim(p_label), coalesce(p_formula, ''),
    p_dice, p_modifier, p_total, p_mode, coalesce(p_detail, '')
  ) on conflict (id) do nothing;

  return p_event_id;
end;
$$;

create or replace function public.revoke_campaign_member(p_campaign_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_campaign_dm(p_campaign_id, auth.uid()) then
    raise exception 'Only the campaign DM can revoke a player.';
  end if;
  if p_user_id = auth.uid() then raise exception 'The campaign DM cannot revoke themselves.'; end if;
  update public.campaign_members member
  set revoked_at = now()
  where member.campaign_id = p_campaign_id and member.user_id = p_user_id and member.role = 'player';
end;
$$;

create or replace function public.clear_campaign_roll_events(p_campaign_id uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted bigint;
begin
  if not public.is_campaign_dm(p_campaign_id, auth.uid()) then
    raise exception 'Only the campaign DM can clear campaign rolls.';
  end if;
  delete from public.roll_events event where event.campaign_id = p_campaign_id;
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke execute on function public.create_campaign(text) from public, anon;
revoke execute on function public.create_campaign_invitation(uuid, uuid, integer) from public, anon;
revoke execute on function public.redeem_campaign_invitation(text, uuid, jsonb, text) from public, anon;
revoke execute on function public.apply_character_mutation(uuid, uuid, bigint, text, jsonb) from public, anon;
revoke execute on function public.record_roll_event(uuid, uuid, text, text, text, text, jsonb, integer, integer, text, text) from public, anon;
revoke execute on function public.revoke_campaign_member(uuid, uuid) from public, anon;
revoke execute on function public.clear_campaign_roll_events(uuid) from public, anon;
grant execute on function public.create_campaign(text) to authenticated;
grant execute on function public.create_campaign_invitation(uuid, uuid, integer) to authenticated;
grant execute on function public.redeem_campaign_invitation(text, uuid, jsonb, text) to authenticated;
grant execute on function public.apply_character_mutation(uuid, uuid, bigint, text, jsonb) to authenticated;
grant execute on function public.record_roll_event(uuid, uuid, text, text, text, text, jsonb, integer, integer, text, text) to authenticated;
grant execute on function public.revoke_campaign_member(uuid, uuid) to authenticated;
grant execute on function public.clear_campaign_roll_events(uuid) to authenticated;

create or replace function public.prune_campaign_roll_events()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.roll_events event
  where event.campaign_id = new.campaign_id
    and event.created_at < now() - interval '30 days';

  delete from public.roll_events event
  where event.id in (
    select older.id
    from public.roll_events older
    where older.campaign_id = new.campaign_id
    order by older.created_at desc
    offset 500
  );
  return null;
end;
$$;

create trigger prune_roll_events_after_insert
after insert on public.roll_events
for each row execute function public.prune_campaign_roll_events();

create or replace function public.broadcast_campaign_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign_id uuid := coalesce(new.campaign_id, old.campaign_id);
  v_character_id text := coalesce(to_jsonb(new) ->> 'character_id', to_jsonb(old) ->> 'character_id');
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
  if v_character_id is not null then
    perform realtime.broadcast_changes(
      'character:' || v_character_id,
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

create trigger broadcast_character_link_changes
after insert or delete on public.characters
for each row execute function public.broadcast_campaign_change();

create trigger broadcast_character_mutations
after insert on public.character_mutations
for each row execute function public.broadcast_campaign_change();

create trigger broadcast_roll_events
after insert or delete on public.roll_events
for each row execute function public.broadcast_campaign_change();

create trigger broadcast_campaign_members
after insert or update or delete on public.campaign_members
for each row execute function public.broadcast_campaign_change();

commit;
