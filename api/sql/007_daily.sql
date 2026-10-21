-- Daily active browsers: how many different browsers sent at least one event each day.
-- Days follow Pakistan time (Asia/Karachi, UTC+5), and the range includes both end days.
-- Days with no events come back as 0, so a chart has no gaps.

create function daily_active(p_site uuid, p_from date, p_to date)
returns table (day date, people bigint)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select d.day::date as day, count(distinct e.anon_id) as people
  from generate_series(p_from, p_to, interval '1 day') as d (day)
  left join events e
    on e.site_id = p_site
   and e.created_at >= (d.day::date::timestamp at time zone 'Asia/Karachi')
   and e.created_at < ((d.day::date + 1)::timestamp at time zone 'Asia/Karachi')
  group by d.day
  order by d.day
$$;

revoke all on function daily_active(uuid, date, date) from public;
grant execute on function daily_active(uuid, date, date) to pm_app_role;
