-- Run ONCE per Neon branch (production, then dev), in Neon's SQL Editor, AFTER the migrations
-- have run (`npm run db:migrate -w @pulse/api`). It is not a migration because it holds passwords.
--
-- 1. Make two long random passwords (for example with `openssl rand -hex 24`).
-- 2. Replace __APP_PASSWORD__ and __INGEST_PASSWORD__ below. Never commit the edited file.
-- 3. Run it, then build the two connection strings from the new users and put them in
--    .env.local and in Render:  DATABASE_URL_APP (pm_app)  and  DATABASE_URL_INGEST (pm_ingest).

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'pm_app') then
    create role pm_app login password '__APP_PASSWORD__' in role pm_app_role;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'pm_ingest') then
    create role pm_ingest login password '__INGEST_PASSWORD__' in role pm_ingest_role;
  end if;
end
$$;
