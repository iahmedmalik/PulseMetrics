-- KEY FILE: the funnel.
--
-- funnel(site, steps, from, to) answers: of the browsers that did step 1, how many then did
-- step 2 (later), and then step 3 (later still), and so on?
--
-- Rules:
--   * a browser counts at step n only if it did steps 1..n in that order, each later than the one before
--   * only events inside [from, to) count
--   * a browser that did step 2 but never step 1 is not in the funnel at all
--   * a browser that repeats a step counts once (we follow its first valid path)
--   * the result always has one row per step, with 0 when nobody got there
--
-- It runs as the caller (security invoker), so row-level security applies: it can only see
-- events of sites the signed-in owner owns.

create function funnel(p_site uuid, p_steps text[], p_from timestamptz, p_to timestamptz)
returns table (step int, name text, people bigint)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with recursive reached (k, anon_id, at) as (
    -- step 1: the first time each browser did the first event inside the range
    select 1, e.anon_id, min(e.created_at)
    from events e
    where e.site_id = p_site
      and e.name = p_steps[1]
      and e.created_at >= p_from
      and e.created_at < p_to
    group by e.anon_id

    union all

    -- step k + 1: the first time that same browser did the next event after reaching step k
    select r.k + 1, r.anon_id, nxt.at
    from reached r
    cross join lateral (
      select min(e.created_at) as at
      from events e
      where e.site_id = p_site
        and e.anon_id = r.anon_id
        and e.name = p_steps[r.k + 1]
        and e.created_at > r.at
        and e.created_at < p_to
    ) nxt
    where r.k < cardinality(p_steps)
      and nxt.at is not null
  )
  select s.k as step, p_steps[s.k] as name, count(r.anon_id) as people
  from generate_series(1, cardinality(p_steps)) as s (k)
  left join reached r on r.k = s.k
  group by s.k
  order by s.k
$$;

revoke all on function funnel(uuid, text[], timestamptz, timestamptz) from public;
grant execute on function funnel(uuid, text[], timestamptz, timestamptz) to pm_app_role;
