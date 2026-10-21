-- Who may do what.
--
-- Two group roles (no login, no password here). Ahmed creates the two login roles in the
-- database console with `sql/roles.sql` and puts them in these groups:
--   pm_app_role     used by the dashboard routes of the API (always acts for one signed-in owner)
--   pm_ingest_role  used only by POST /v1/track, and it can run one function and nothing else

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'pm_app_role') then
    create role pm_app_role nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'pm_ingest_role') then
    create role pm_ingest_role nologin;
  end if;
end
$$;

-- Nothing is public by default.
revoke all on all tables in schema public from public;
revoke all on all functions in schema public from public;

-- Sign-in tables: Better Auth runs as pm_app_role and needs full access to its own tables.
grant select, insert, update, delete on "user", session, account, verification to pm_app_role;

-- Sites: an owner manages their own rows. Events: read only, and only for their own sites.
-- (An owner can rename a site and replace its key, but never edit the event counter.)
grant select, delete on sites to pm_app_role;
grant insert (owner_id, name) on sites to pm_app_role;
grant update (name, public_key) on sites to pm_app_role;
grant select on events to pm_app_role;

alter table sites enable row level security;
alter table events enable row level security;

-- Every dashboard request first runs: select set_config('app.owner_id', '<user id>', true)
-- inside its transaction. With no setting, current_setting returns null and nothing matches.
create policy sites_owner on sites
  for all to pm_app_role
  using (owner_id = current_setting('app.owner_id', true))
  with check (owner_id = current_setting('app.owner_id', true));

create policy events_owner_read on events
  for select to pm_app_role
  using (exists (
    select 1 from sites s
    where s.id = events.site_id and s.owner_id = current_setting('app.owner_id', true)
  ));
