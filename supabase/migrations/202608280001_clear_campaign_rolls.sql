begin;

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

revoke execute on function public.clear_campaign_roll_events(uuid) from public, anon;
grant execute on function public.clear_campaign_roll_events(uuid) to authenticated;

drop trigger if exists broadcast_roll_events on public.roll_events;
create trigger broadcast_roll_events
after insert or delete on public.roll_events
for each row execute function public.broadcast_campaign_change();

commit;
