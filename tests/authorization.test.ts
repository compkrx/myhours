import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
let pg: PGlite;
const a = "11111111-1111-4111-8111-111111111111",
  b = "22222222-2222-4222-8222-222222222222",
  id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const record = (title: string) =>
  JSON.stringify({ id, kind: "task", data: { title }, revision: 1 });
async function as(uid: string) {
  await pg.exec("reset role; set role authenticated");
  await pg.query("select set_config('request.jwt.claim.sub',$1,false)", [uid]);
}
beforeAll(async () => {
  pg = await PGlite.create();
  await pg.exec(
    `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`,
  );
  await pg.exec(
    await readFile(
      "supabase/migrations/202611210001_private_records.sql",
      "utf8",
    ),
  );
  await pg.query("insert into auth.users(id,email) values ($1,$2),($3,$4)", [
    a,
    "a@example.invalid",
    b,
    "b@example.invalid",
  ]);
}, 30000);
afterAll(async () => {
  await pg?.close();
});
describe("actual PostgreSQL authorization (local engine, mocked auth claims)", () => {
  it("requires authentication and isolates records for two accounts", async () => {
    await as(a);
    await pg.query("select public.put_life_record($1,$2::jsonb,0)", [
      id,
      record("A private record"),
    ]);
    expect(
      (await pg.query("select * from public.life_records")).rows,
    ).toHaveLength(1);
    await as(b);
    expect(
      (await pg.query("select * from public.life_records")).rows,
    ).toHaveLength(0);
    await pg.query("select public.put_life_record($1,$2::jsonb,0)", [
      id,
      record("B private record"),
    ]);
    const rows = await pg.query<{ record: { data: { title: string } } }>(
      "select record from public.life_records",
    );
    expect(rows.rows[0].record.data.title).toBe("B private record");
    await as(a);
    const original = await pg.query<{ record: { data: { title: string } } }>(
      "select record from public.life_records",
    );
    expect(original.rows[0].record.data.title).toBe("A private record");
  });
  it("rejects stale updates, anonymous reads and direct writes", async () => {
    await as(a);
    await expect(
      pg.query("select public.put_life_record($1,$2::jsonb,0)", [
        id,
        record("stale"),
      ]),
    ).rejects.toThrow("sync conflict");
    await expect(
      pg.query("update public.life_records set record=$1::jsonb", [
        record("bypass"),
      ]),
    ).rejects.toThrow("permission denied");
    await pg.exec("reset role;set role anon");
    await expect(pg.query("select * from public.life_records")).rejects.toThrow(
      "permission denied",
    );
  });
  it("prevents browser quota bypass and bounds service-side requests", async () => {
    await as(a);
    await expect(
      pg.query("select public.reserve_ai_request($1)", [b]),
    ).rejects.toThrow("permission denied");
    await pg.exec("reset role;set role service_role");
    expect(
      (
        await pg.query<{ reserve_ai_request: number }>(
          "select public.reserve_ai_request($1)",
          [a],
        )
      ).rows[0].reserve_ai_request,
    ).toBe(1);
    await expect(
      pg.query("select public.reserve_ai_request($1)", [a]),
    ).rejects.toThrow("rate limited");
  });
  it("deletes only the current authenticated account and its rows", async () => {
    await as(b);
    await pg.query("select public.delete_my_account()");
    await pg.exec("reset role");
    const users = await pg.query<{ id: string }>("select id from auth.users");
    expect(users.rows.map((r) => r.id)).toEqual([a]);
    await as(a);
    expect(
      (await pg.query("select * from public.life_records")).rows,
    ).toHaveLength(1);
  });
});
