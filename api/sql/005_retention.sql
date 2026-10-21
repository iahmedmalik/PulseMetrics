-- Retention: events older than 180 days are deleted, and each site's counter is recalculated.
-- Called once a day by POST /internal/retention (protected by a secret), never by a person.

create function purge_old_events(p_days int default 180)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_deleted bigint;
begin
  if p_days is null or p_days < 30 then
    raise exception 'retention is at least 30 days';
  end if;

  with gone as (
    delete from events where created_at < now() - make_interval(days => p_days) returning 1
  )
  select count(*) into v_deleted from gone;

  update sites s
  set event_count = (select count(*) from events e where e.site_id = s.id)
  where v_deleted > 0;

  return v_deleted;
end
$$;

revoke all on function purge_old_events(int) from public;
grant execute on function purge_old_events(int) to pm_app_role;
