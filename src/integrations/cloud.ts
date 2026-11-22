import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Repository, LifeDB } from "../data/repository";
import { recordSchema, type LifeRecord } from "../domain/model";
import { stableHash, syncDecision } from "../domain/sync";
export const cloudConfigured = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY,
);
let client: SupabaseClient | undefined;
export function cloud() {
  if (!cloudConfigured)
    throw new Error(
      "Cloud is not configured. Add the public Supabase URL and anon key at build time.",
    );
  return (client ??= createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY,
  ));
}
export function accountRepository(uid: string) {
  return new Repository(new LifeDB(`project-life-account-${uid}`));
}
const hash = stableHash;
export interface SyncConflict {
  local: LifeRecord;
  remote: LifeRecord;
  version: number;
}
export async function syncRecords(repo: Repository, uid: string) {
  const { data, error } = await cloud()
    .from("life_records")
    .select("id,record,version")
    .eq("user_id", uid);
  if (error) throw error;
  const remote = new Map(
    (data ?? []).map((row) => [
      String(row.id),
      { record: recordSchema.parse(row.record), version: Number(row.version) },
    ]),
  );
  const locals = await repo.db.records.toArray();
  const conflicts: SyncConflict[] = [];
  let transferred = 0;
  for (const local of locals) {
    const row = remote.get(local.id);
    const base = await repo.db.syncState.get(local.id);
    remote.delete(local.id);
    const decision = syncDecision(local, row, base);
    if (decision === "same") {
      if (row)
        await repo.db.syncState.put({
          id: local.id,
          revision: row.version,
          hash: hash(local),
        });
      continue;
    }
    if (decision === "conflict") {
      conflicts.push({ local, remote: row!.record, version: row!.version });
      continue;
    }
    if (row && decision === "pull") {
      await pull(repo, row.record, row.version, local);
      transferred++;
    } else if (decision === "push") {
      await push(repo, local, row?.version ?? 0);
      transferred++;
    }
  }
  for (const row of remote.values()) {
    await pull(repo, row.record, row.version);
    transferred++;
  }
  return { conflicts, transferred };
}
async function pull(
  repo: Repository,
  record: LifeRecord,
  version: number,
  expected?: LifeRecord,
) {
  await repo.db.transaction(
    "rw",
    repo.db.records,
    repo.db.syncState,
    async () => {
      const current = await repo.db.records.get(record.id);
      if (
        (expected && (!current || hash(current) !== hash(expected))) ||
        (!expected && current)
      )
        throw new Error(
          "A local record changed during sync. No local edits were overwritten. Sync again to compare.",
        );
      await repo.db.records.put(record);
      await repo.db.syncState.put({
        id: record.id,
        revision: version,
        hash: hash(record),
      });
    },
  );
}
async function push(repo: Repository, record: LifeRecord, expected: number) {
  const { data, error } = await cloud().rpc("put_life_record", {
    p_id: record.id,
    p_record: record,
    p_expected: expected,
  });
  if (error)
    throw new Error(
      error.message.includes("conflict")
        ? "The cloud changed while syncing. Sync again to compare changes."
        : error.message,
    );
  await repo.db.syncState.put({
    id: record.id,
    revision: Number(data),
    hash: hash(record),
  });
}
export async function resolveConflict(
  repo: Repository,
  conflict: SyncConflict,
  choice: "local" | "remote",
) {
  const current = await repo.db.records.get(conflict.local.id);
  if (!current || hash(current) !== hash(conflict.local))
    throw new Error(
      "Your local version changed after this preview. Sync again before resolving.",
    );
  if (choice === "local") await push(repo, conflict.local, conflict.version);
  else await pull(repo, conflict.remote, conflict.version, conflict.local);
}
