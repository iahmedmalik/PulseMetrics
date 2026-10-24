-- Better Auth must find an account before a session exists. Its trusted backend role
-- therefore has an explicit service policy; it is never a browser-facing database role.
-- The ingest role has no table grants and cannot use these policies.

alter table "user" enable row level security;
alter table session enable row level security;
alter table account enable row level security;
alter table verification enable row level security;

create policy auth_backend on "user"
  for all to pm_app_role using (true) with check (true);
create policy auth_backend on session
  for all to pm_app_role using (true) with check (true);
create policy auth_backend on account
  for all to pm_app_role using (true) with check (true);
create policy auth_backend on verification
  for all to pm_app_role using (true) with check (true);

revoke all on "user", session, account, verification from public, pm_ingest_role;

-- Only the table owner applies migrations. No runtime policy or grant is needed.
alter table _migrations enable row level security;
revoke all on _migrations from public, pm_app_role, pm_ingest_role;
