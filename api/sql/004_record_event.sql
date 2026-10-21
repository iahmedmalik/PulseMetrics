-- The only way an event gets in. It runs with the rights of the table owner (security definer),
-- so the ingest role needs no access to any table, and it re-checks every value itself.
--
-- Answers with a word instead of raising, so the API can map it to a status code:
--   ok | bad | unknown_key | full

create function record_event(p_key text, p_anon text, p_name text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_site uuid;
  v_count bigint;
  c_cap constant bigint := 200000;
begin
  if p_key is null or p_key !~ '^[a-f0-9]{24}$'
     or p_anon is null or p_anon !~ '^[a-z0-9]{16,32}$'
     or p_name is null or p_name !~ '^[a-z][a-z0-9_]{1,39}$' then
    return 'bad';
  end if;

  select id, event_count into v_site, v_count from sites where public_key = p_key for update;
  if v_site is null then
    return 'unknown_key';
  end if;
  if v_count >= c_cap then
    return 'full';
  end if;

  insert into events (site_id, anon_id, name) values (v_site, p_anon, p_name);
  update sites set event_count = event_count + 1 where id = v_site;
  return 'ok';
end
$$;

revoke all on function record_event(text, text, text) from public;
grant execute on function record_event(text, text, text) to pm_ingest_role;
