import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { asOwner, connect, denied, newAnon, newId, seedEvent, seedOwner, seedSite, urls } from "./helpers";

// The role check: act as each kind of caller and prove what each one can and cannot do.
// These run against a real local Postgres with every migration applied.

let owner: Client; // the table owner: sets things up, bypasses the rules
let app: Client; // pm_app: what the dashboard routes use
let ingest: Client; // pm_ingest: what POST /v1/track uses

const alice = newId("alice");
const bob = newId("bob");
let aliceSite: { id: string; key: string };
let bobSite: { id: string; key: string };

beforeAll(async () => {
  owner = await connect(urls.owner());
  app = await connect(urls.app());
  ingest = await connect(urls.ingest());
  await seedOwner(owner, alice);
  await seedOwner(owner, bob);
  aliceSite = await seedSite(owner, alice, "Alice's app");
  bobSite = await seedSite(owner, bob, "Bob's app");
  await seedEvent(owner, aliceSite.id, newAnon(), "queue_joined", new Date());
});

afterAll(async () => {
  await Promise.all([owner?.end(), app?.end(), ingest?.end()]);
});

const rec = (key: string, anon: string, name: string) =>
  ingest.query<{ r: string }>("select record_event($1, $2, $3) as r", [key, anon, name]).then((x) => x.rows[0]!.r);

describe("every application table has a row-security boundary", () => {
  it("enables RLS on all seven tables, including authentication and the ledger", async () => {
    const rows = await owner.query<{ name: string; enabled: boolean }>(`
      select c.relname as name, c.relrowsecurity as enabled
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
      order by c.relname
    `);
    expect(rows.rows.map((row) => row.name)).toEqual(["_migrations", "account", "events", "session", "sites", "user", "verification"]);
    expect(rows.rows.filter((row) => !row.enabled).map((row) => row.name)).toEqual([]);
  });

  it("neither runtime can read or alter the migration ledger", async () => {
    for (const client of [app, ingest]) {
      expect(await denied(client.query("select * from _migrations"))).toBe(true);
      expect(await denied(client.query("update _migrations set checksum = 'changed' where false"))).toBe(true);
    }
  });

  it("ingest cannot read session or verification records", async () => {
    expect(await denied(ingest.query("select * from session"))).toBe(true);
    expect(await denied(ingest.query("select * from verification"))).toBe(true);
  });
});

describe("record_event (the only way an event gets in)", () => {
  it("stores a valid event and counts it", async () => {
    const before = (await owner.query("select event_count from sites where id = $1", [aliceSite.id])).rows[0].event_count;
    expect(await rec(aliceSite.key, newAnon(), "payment_recorded")).toBe("ok");
    const after = (await owner.query("select event_count from sites where id = $1", [aliceSite.id])).rows[0].event_count;
    expect(Number(after)).toBe(Number(before) + 1);
  });

  it("answers unknown_key for a key nobody owns", async () => {
    expect(await rec("0".repeat(24), newAnon(), "queue_joined")).toBe("unknown_key");
  });

  it.each([
    ["a key that is not 24 hex characters", "short", newAnon(), "queue_joined"],
    ["a browser id that is too short", "KEY", "abc", "queue_joined"],
    ["a name with a slash (a page address)", "KEY", newAnon(), "/m/abc123"],
    ["a name with capitals", "KEY", newAnon(), "QueueJoined"],
    ["a name starting with a digit", "KEY", newAnon(), "1queue"],
    ["an email address as a name", "KEY", newAnon(), "ali@example.com"],
  ])("answers bad for %s", async (_label, key, anon, name) => {
    expect(await rec(key === "KEY" ? aliceSite.key : key, anon, name)).toBe("bad");
  });

  it("answers full once a site reaches its cap (200,000 events)", async () => {
    const site = await seedSite(owner, alice, "Full site");
    await owner.query("update sites set event_count = 200000 where id = $1", [site.id]);
    expect(await rec(site.key, newAnon(), "queue_joined")).toBe("full");
    const n = await owner.query("select count(*)::int as n from events where site_id = $1", [site.id]);
    expect(n.rows[0].n).toBe(0);
  });
});

describe("the ingest role can do one thing only", () => {
  it("cannot read sites, events or accounts", async () => {
    expect(await denied(ingest.query("select * from events"))).toBe(true);
    expect(await denied(ingest.query("select * from sites"))).toBe(true);
    expect(await denied(ingest.query('select * from "user"'))).toBe(true);
    expect(await denied(ingest.query("select * from account"))).toBe(true);
  });

  it("cannot write to tables directly", async () => {
    expect(
      await denied(ingest.query("insert into events (site_id, anon_id, name) values ($1, $2, $3)", [aliceSite.id, newAnon(), "queue_joined"])),
    ).toBe(true);
    expect(await denied(ingest.query("delete from events"))).toBe(true);
    expect(await denied(ingest.query("update sites set name = 'x'"))).toBe(true);
  });

  it("cannot run the dashboard functions or the cleanup", async () => {
    expect(await denied(ingest.query("select purge_old_events(180)"))).toBe(true);
  });
});

describe("owners only see their own data (row-level security)", () => {
  it("each owner sees only their own sites", async () => {
    const a = await asOwner(app, alice, async () => (await app.query("select id from sites")).rows.map((r) => r.id));
    expect(a).toContain(aliceSite.id);
    expect(a).not.toContain(bobSite.id);
    const b = await asOwner(app, bob, async () => (await app.query("select id from sites")).rows.map((r) => r.id));
    expect(b).toContain(bobSite.id);
    expect(b).not.toContain(aliceSite.id);
  });

  it("an owner reads the events of their own sites", async () => {
    const n = await asOwner(app, alice, async () => (await app.query("select count(*)::int as n from events where site_id = $1", [aliceSite.id])).rows[0].n);
    expect(n).toBeGreaterThan(0);
  });

  it("another owner cannot read those events", async () => {
    const n = await asOwner(app, bob, async () => (await app.query("select count(*)::int as n from events where site_id = $1", [aliceSite.id])).rows[0].n);
    expect(n).toBe(0);
  });

  it("with nobody signed in (no owner set) nothing is visible", async () => {
    const sites = await asOwner(app, null, async () => (await app.query("select count(*)::int as n from sites")).rows[0].n);
    const events = await asOwner(app, null, async () => (await app.query("select count(*)::int as n from events")).rows[0].n);
    expect(sites).toBe(0);
    expect(events).toBe(0);
  });

  it("an owner cannot create a site for someone else", async () => {
    const result = await asOwner(app, bob, () =>
      denied(app.query("insert into sites (owner_id, name) values ($1, 'stolen')", [alice])),
    );
    expect(result).toBe(true);
  });

  it("an owner can create their own site and gets a key", async () => {
    const row = await asOwner(app, bob, async () => (await app.query("insert into sites (owner_id, name) values ($1, 'Mine') returning public_key", [bob])).rows[0]);
    expect(row.public_key).toMatch(/^[a-f0-9]{24}$/);
  });

  it("another owner can neither rename nor delete a site", async () => {
    const renamed = await asOwner(app, bob, async () => (await app.query("update sites set name = 'hacked' where id = $1", [aliceSite.id])).rowCount);
    const deleted = await asOwner(app, bob, async () => (await app.query("delete from sites where id = $1", [aliceSite.id])).rowCount);
    expect(renamed).toBe(0);
    expect(deleted).toBe(0);
  });

  it("the owner can rename a site and replace its key; the old key then stops working", async () => {
    const site = await seedSite(owner, alice, "Rotating");
    const newKey = randomBytes(12).toString("hex"); // random: the test database keeps its data between runs
    await asOwner(app, alice, async () => {
      await app.query("update sites set name = 'Renamed', public_key = $2 where id = $1", [site.id, newKey]);
    });
    // asOwner rolls back; do it for real with the table owner to test the key swap through record_event
    await owner.query("update sites set public_key = $2 where id = $1", [site.id, newKey]);
    expect(await rec(site.key, newAnon(), "queue_joined")).toBe("unknown_key");
    expect(await rec(newKey, newAnon(), "queue_joined")).toBe("ok");
  });
});

describe("events can never be edited or deleted by the dashboard", () => {
  it("pm_app cannot insert, update or delete events", async () => {
    await asOwner(app, alice, async () => {
      expect(await denied(app.query("insert into events (site_id, anon_id, name) values ($1, $2, $3)", [aliceSite.id, newAnon(), "queue_joined"]))).toBe(true);
    });
    await asOwner(app, alice, async () => {
      expect(await denied(app.query("update events set name = 'edited_name'"))).toBe(true);
    });
    await asOwner(app, alice, async () => {
      expect(await denied(app.query("delete from events"))).toBe(true);
    });
  });

  it("an owner cannot edit the event counter of their own site", async () => {
    await asOwner(app, alice, async () => {
      expect(await denied(app.query("update sites set event_count = 0 where id = $1", [aliceSite.id]))).toBe(true);
    });
  });
});

describe("rule P-1 is built into the table", () => {
  it("events has exactly five columns and no free-text column except the name", async () => {
    const cols = (
      await owner.query("select column_name from information_schema.columns where table_name = 'events' order by ordinal_position")
    ).rows.map((r) => r.column_name);
    expect(cols).toEqual(["id", "site_id", "anon_id", "name", "created_at"]);
  });

  it("the table itself refuses a bad name, even for the table owner", async () => {
    await expect(
      owner.query("insert into events (site_id, anon_id, name) values ($1, $2, $3)", [aliceSite.id, newAnon(), "https://x.test/m/abc"]),
    ).rejects.toThrow(/events_name_check/);
  });

  it("the table itself refuses a bad browser id", async () => {
    await expect(
      owner.query("insert into events (site_id, anon_id, name) values ($1, $2, $3)", [aliceSite.id, "Not Valid!", "queue_joined"]),
    ).rejects.toThrow(/events_anon_id_check/);
  });
});

describe("retention (events older than 180 days are deleted)", () => {
  it("deletes only old events and recalculates the counter", async () => {
    const site = await seedSite(owner, alice, "Retention");
    const old = new Date(Date.now() - 200 * 24 * 3600 * 1000);
    const recent = new Date(Date.now() - 10 * 24 * 3600 * 1000);
    await seedEvent(owner, site.id, newAnon(), "queue_joined", old);
    await seedEvent(owner, site.id, newAnon(), "queue_joined", old);
    await seedEvent(owner, site.id, newAnon(), "queue_joined", recent);
    await owner.query("update sites set event_count = 3 where id = $1", [site.id]);

    const deleted = Number((await app.query("select purge_old_events(180) as n")).rows[0].n);
    expect(deleted).toBeGreaterThanOrEqual(2);

    const left = (await owner.query("select count(*)::int as n from events where site_id = $1", [site.id])).rows[0].n;
    const counter = Number((await owner.query("select event_count from sites where id = $1", [site.id])).rows[0].event_count);
    expect(left).toBe(1);
    expect(counter).toBe(1);
  });

  it("refuses a retention shorter than 30 days", async () => {
    await expect(app.query("select purge_old_events(5)")).rejects.toThrow(/at least 30 days/);
  });
});
