import { randomUUID } from "node:crypto";
import { Client } from "pg";

// Run against an explicitly named development host. Credentials stay in .env.local.
// All fixture rows are created in one transaction and rolled back, even on failure.
const expectedHost = process.argv.find((arg) => arg.startsWith("--expected-host="))?.split("=")[1];
if (!expectedHost) throw new Error("Pass --expected-host=<development database hostname> to confirm the target.");
const appUrl = new URL(process.env.DATABASE_URL_APP ?? "");
const ingestUrl = new URL(process.env.DATABASE_URL_INGEST ?? "");
for (const url of [appUrl, ingestUrl]) {
  if (url.hostname !== expectedHost || url.pathname !== appUrl.pathname) throw new Error("Database target does not match the confirmed development host.");
}
const app = new Client({ connectionString: appUrl.href, connectionTimeoutMillis: 20000 });
const ingest = new Client({ connectionString: ingestUrl.href, connectionTimeoutMillis: 20000 });
let passed = 0;
function check(label, condition) {
  if (!condition) throw new Error(`FAIL ${label}`);
  passed++;
  console.log(`PASS ${label}`);
}
const tables = ["_migrations", "account", "events", "session", "sites", "user", "verification"];
try {
  await app.connect();
  await ingest.connect();
  for (const [client, group] of [[app, "pm_app_role"], [ingest, "pm_ingest_role"]]) {
    const { rows: [role] } = await client.query(`
      select rolcanlogin, rolsuper, rolcreatedb, rolcreaterole, rolbypassrls,
             pg_has_role(current_user, $1, 'member') as expected_group
      from pg_roles where rolname = current_user
    `, [group]);
    check(`${group} runtime can log in and has expected membership`, role.rolcanlogin && role.expected_group);
    check(`${group} runtime has no administrative attributes`, !role.rolsuper && !role.rolcreatedb && !role.rolcreaterole && !role.rolbypassrls);
    const { rows: [admin] } = await client.query("select exists(select 1 from pg_roles where rolname='neon_superuser') as present");
    if (admin.present) {
      const { rows: [member] } = await client.query("select pg_has_role(current_user, 'neon_superuser', 'member') as admin");
      check(`${group} runtime has no Neon admin membership`, !member.admin);
    }
  }
  const { rows: catalog } = await app.query(`
    select c.relname as name, c.relrowsecurity as enabled
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r' order by c.relname
  `);
  for (const table of tables) check(`${table} has RLS`, catalog.some((row) => row.name === table && row.enabled));
  for (const table of tables) {
    const { rows: [grants] } = await ingest.query("select has_table_privilege(current_user, $1, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') as allowed", [`public."${table}"`]);
    check(`ingest has no direct privileges on ${table}`, !grants.allowed);
  }
  for (const client of [app, ingest]) {
    const { rows: [grants] } = await client.query("select has_table_privilege(current_user, 'public._migrations', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') as allowed");
    check(`${client === app ? "app" : "ingest"} has no ledger privileges`, !grants.allowed);
  }
  const { rows: [functions] } = await ingest.query(`
    select has_function_privilege(current_user, 'record_event(text,text,text)', 'EXECUTE') as record,
           has_function_privilege(current_user, 'purge_old_events(integer)', 'EXECUTE') as retention
  `);
  check("ingest can execute record_event", functions.record);
  check("ingest cannot execute retention", !functions.retention);
  const { rows: [unknown] } = await ingest.query("select record_event($1,$2,$3) as result", ["0".repeat(24), "securitycheck001", "security_check"]);
  check("ingest function rejects an unknown site key", unknown.result === "unknown_key");

  await app.query("begin");
  try {
    const a = `role-check-a-${randomUUID()}`;
    const b = `role-check-b-${randomUUID()}`;
    for (const id of [a, b]) await app.query('insert into "user" (id,name,email) values ($1,$2,$3)', [id, "Security check fixture", `${id}@example.com`]);
    await app.query("select set_config('app.owner_id',$1,true)", [a]);
    const { rows: [siteA] } = await app.query("insert into sites(owner_id,name) values ($1,'Role check A') returning id", [a]);
    await app.query("select set_config('app.owner_id',$1,true)", [b]);
    const { rows: [siteB] } = await app.query("insert into sites(owner_id,name) values ($1,'Role check B') returning id", [b]);
    for (const [owner, own, other] of [[a, siteA.id, siteB.id], [b, siteB.id, siteA.id]]) {
      await app.query("select set_config('app.owner_id',$1,true)", [owner]);
      const { rows } = await app.query("select id from sites");
      check(`owner ${owner === a ? "A" : "B"} sees only their fixture site`, rows.length === 1 && rows[0].id === own);
      const renamed = await app.query("update sites set name='Cross-owner attempt' where id=$1 returning id", [other]);
      check(`owner ${owner === a ? "A" : "B"} cannot rename the other's site`, renamed.rowCount === 0);
    }
    await app.query("select set_config('app.owner_id','',true)");
    check("without an owner no sites are visible", (await app.query("select id from sites")).rows.length === 0);
    check("without an owner no events are visible", (await app.query("select id from events")).rows.length === 0);
  } finally {
    await app.query("rollback");
  }
  const { rows: [context] } = await app.query("select nullif(current_setting('app.owner_id',true),'') as owner");
  check("owner context is cleared after the transaction", context.owner === null);
  console.log(`${passed} role checks passed. All fixture rows rolled back.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Security check failed.");
  process.exitCode = 1;
} finally {
  await Promise.allSettled([app.end(), ingest.end()]);
}
