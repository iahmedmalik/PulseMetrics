import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrate } from "./migrate";

// The migration runner against a scratch database, with two tiny made-up migration files.

let admin: Client;
let scratch: Client;
let dir: string;
const dbName = `migtest_${Date.now()}`;

beforeAll(async () => {
  const ownerUrl = process.env.TEST_OWNER_URL as string;
  admin = new Client({ connectionString: ownerUrl });
  await admin.connect();
  await admin.query(`create database ${dbName}`);
  scratch = new Client({ connectionString: ownerUrl.replace(/\/pulse$/, `/${dbName}`) });
  await scratch.connect();
  dir = await mkdtemp(path.join(os.tmpdir(), "pulse-mig-"));
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "001_first.sql"), "create table one (id int);");
  await writeFile(path.join(dir, "002_second.sql"), "create table two (id int);");
});

afterAll(async () => {
  await scratch?.end();
  await admin?.query(`drop database if exists ${dbName} with (force)`);
  await admin?.end();
  await rm(dir, { recursive: true, force: true });
});

describe("migrate", () => {
  it("applies new files in order and remembers them", async () => {
    expect(await migrate(scratch, dir)).toEqual(["001_first.sql", "002_second.sql"]);
    const names = (await scratch.query("select name from _migrations order by name")).rows.map((r) => r.name);
    expect(names).toEqual(["001_first.sql", "002_second.sql"]);
  });

  it("does nothing the second time", async () => {
    expect(await migrate(scratch, dir)).toEqual([]);
  });

  it("applies a file that arrives later, without touching the old ones", async () => {
    await writeFile(path.join(dir, "003_third.sql"), "create table three (id int);");
    expect(await migrate(scratch, dir)).toEqual(["003_third.sql"]);
  });

  it("refuses to go on when a file that already ran has been edited", async () => {
    await writeFile(path.join(dir, "001_first.sql"), "create table one (id int, extra text);");
    await expect(migrate(scratch, dir)).rejects.toThrow(/was edited after it ran/);
  });

  it("rolls a broken file back completely and says which file failed", async () => {
    await writeFile(path.join(dir, "001_first.sql"), "create table one (id int);");
    await writeFile(path.join(dir, "004_broken.sql"), "create table four (id int); select nonsense from nowhere;");
    await expect(migrate(scratch, dir)).rejects.toThrow(/004_broken\.sql failed/);
    const exists = await scratch.query("select to_regclass('public.four') as t");
    expect(exists.rows[0].t).toBeNull();
  });
});
