import Dexie, { type EntityTable } from "dexie";
import { addDay, dayKey, inZone, localInput } from "../domain/time";
import {
  dataSchemas,
  defaultPreferences,
  recordSchema,
  settingsSchema,
  type Fields,
  type Kind,
  type LifeRecord,
  type Preferences,
} from "../domain/model";

export class LifeDB extends Dexie {
  records!: EntityTable<LifeRecord, "id">;
  preferences!: EntityTable<Preferences, "id">;
  syncState!: EntityTable<{ id: string; revision: number; hash: string }, "id">;
  constructor(name = "project-life-local-v1") {
    super(name);
    this.version(1).stores({
      records: "id,kind,updatedAt,deletedAt",
      preferences: "id",
    });
    this.version(2).stores({
      records: "id,kind,updatedAt,deletedAt",
      preferences: "id",
      syncState: "id",
    });
    this.version(3).stores({records:'id,kind,updatedAt,deletedAt',preferences:'id',syncState:'id'}).upgrade(tx=>tx.table('preferences').toCollection().modify(p=>{p.petEnabled??=false;p.petName??='Pip';p.petWalking??=true;}));
  }
}
export class RevisionConflict extends Error {
  constructor() {
    super(
      "This record changed in another tab or device. Reopen it to compare your changes.",
    );
  }
}
export class Repository {
  constructor(public db: LifeDB) {}
  async preferences() {
    return settingsSchema.parse((await this.db.preferences.get("preferences")) ?? defaultPreferences());
  }
  async setPreferences(p: Preferences) {
    await this.db.preferences.put(settingsSchema.parse(p));
  }
  async list(kind?: Kind) {
    const all = kind
      ? await this.db.records.where("kind").equals(kind).toArray()
      : await this.db.records.toArray();
    return all
      .filter((r) => !r.deletedAt)
      .sort(
        (a, b) =>
          a.sortOrder - b.sortOrder || b.updatedAt.localeCompare(a.updatedAt),
      );
  }
  async save(
    kind: Kind,
    data: Fields,
    old?: LifeRecord,
    source: LifeRecord["provenance"] = "manual",
  ) {
    const clean = dataSchemas[kind].parse(data) as Fields;
    return this.db.transaction("rw", this.db.records, async () => {
      if (old) {
        const latest = await this.db.records.get(old.id);
        if (!latest || latest.revision !== old.revision || latest.deletedAt)
          throw new RevisionConflict();
      }
      const live = (await this.db.records.toArray()).filter(
        (r) => !r.deletedAt && r.id !== old?.id,
      );
      if (
        kind === "project" &&
        clean.status === "active" &&
        live.some((r) => r.kind === "project" && r.data.status === "active")
      )
        throw new Error(
          "Keep one major project active. Queue this one, or pause your current project first.",
        );
      if (
        kind === "routine" &&
        clean.day &&
        live.some((r) => r.kind === "routine" && r.data.day === clean.day)
      )
        throw new Error("There is already a saved routine for this day. Edit it instead.");
      if (
        kind === "focus" &&
        live.filter((r) => r.kind === "focus" && r.data.role === clean.role)
          .length >= (clean.role === "primary" ? 1 : 2)
      )
        throw new Error(
          "Keep one primary focus and up to two explorations. Edit an existing focus first.",
        );
      for (const key of ["courseId", "focusId", "projectId"]) {
        const ref = clean[key];
        if (
          ref &&
          !live.some(
            (r) =>
              r.id === ref &&
              r.kind ===
                { courseId: "course", focusId: "focus", projectId: "project" }[
                  key
                ],
          )
        )
          throw new Error(`Choose an existing ${key.replace("Id", "")}.`);
      }
      if (Array.isArray(clean.dependencies))
        for (const id of clean.dependencies) {
          if (
            id === old?.id ||
            !live.some(
              (r) => r.id === id && ["task", "assignment"].includes(r.kind),
            )
          )
            throw new Error("Dependencies must refer to other existing tasks.");
        }
      const now = new Date().toISOString();
      const record = recordSchema.parse({
        id: old?.id ?? crypto.randomUUID(),
        kind,
        data: clean,
        createdAt: old?.createdAt ?? now,
        updatedAt: now,
        revision: (old?.revision ?? 0) + 1,
        sortOrder: old?.sortOrder ?? Date.now(),
        provenance: old?.provenance ?? source,
      });
      await this.db.records.put(record);
      return record;
    });
  }
  async complete(record: LifeRecord, timezone: string, now = new Date()) {
    return this.db.transaction("rw", this.db.records, async () => {
      const done = ["done", "submitted", "excused"].includes(
        String(record.data.status),
      );
      const saved = await this.save(
        record.kind,
        { ...record.data, status: done ? "open" : "done" },
        record,
      );
      const recurrence = String(record.data.recurrence || "none");
      if (
        !done &&
        recurrence !== "none" &&
        !(await this.db.records.toArray()).some(
          (r) => r.data.repeatOf === record.id,
        )
      ) {
        const due = String(record.data.due || "");
        const today = dayKey(now, timezone);
        const oldDay = due
          ? due.length === 10
            ? due
            : dayKey(due, timezone)
          : today;
        const nextDay = addDay(
          oldDay > today ? oldDay : today,
          recurrence === "weekly" ? 7 : 1,
        );
        const nextDue =
          due.length > 10
            ? inZone(
                nextDay,
                localInput(due, timezone).slice(11, 16),
                timezone,
              ).toISOString()
            : nextDay;
        await this.save(record.kind, {
          ...record.data,
          status: "open",
          due: nextDue,
          repeatOf: record.id,
          priorityOrder: 0,
        });
      }
      return saved;
    });
  }
  async remove(record: LifeRecord) {
    return this.db.transaction("rw", this.db.records, async () => {
      const latest = await this.db.records.get(record.id);
      if (!latest || latest.revision !== record.revision)
        throw new RevisionConflict();
      const refs = (await this.list()).filter(
        (r) =>
          r.id !== record.id &&
          (["courseId", "focusId", "projectId", "taskId"].some(
            (k) => r.data[k] === record.id,
          ) ||
            (Array.isArray(r.data.dependencies) &&
              r.data.dependencies.includes(record.id))),
      );
      if (refs.length)
        throw new Error(
          `This item is linked to ${refs.length} record(s). Remove those links first.`,
        );
      await this.db.records.put({
        ...record,
        deletedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        revision: record.revision + 1,
      });
    });
  }
  async undo(record: LifeRecord) {
    const latest = await this.db.records.get(record.id);
    if (!latest?.deletedAt || latest.revision !== record.revision + 1)
      throw new RevisionConflict();
    const restored = {
      ...latest,
      deletedAt: undefined,
      updatedAt: new Date().toISOString(),
      revision: latest.revision + 1,
    };
    await this.db.records.put(restored);
  }
  async replaceAll(records: LifeRecord[], preferences: Preferences) {
    const parsed = records.map((r) => recordSchema.parse(r));
    const p = settingsSchema.parse(preferences);
    if (new Set(parsed.map((r) => r.id)).size !== parsed.length)
      throw new Error("Duplicate record IDs in backup.");
    await this.db.transaction(
      "rw",
      this.db.records,
      this.db.preferences,
      this.db.syncState,
      async () => {
        await this.db.records.clear();
        await this.db.records.bulkPut(parsed);
        await this.db.preferences.put(p);
        await this.db.syncState.clear();
      },
    );
  }
  async mergeNew(records:LifeRecord[]) {
    const parsed=records.map(r=>recordSchema.parse(r));
    if(new Set(parsed.map(r=>r.id)).size!==parsed.length)throw new Error('Duplicate record IDs in import.');
    return this.db.transaction('rw',this.db.records,async()=>{
      const existing=await this.db.records.toArray();const ids=new Set(existing.map(r=>r.id));const fresh=parsed.filter(r=>!r.deletedAt&&!ids.has(r.id));const merged=[...existing,...fresh].filter(r=>!r.deletedAt);const allIds=new Set(merged.map(r=>r.id));
      if(merged.filter(r=>r.kind==='project'&&r.data.status==='active').length>1)throw new Error('The merge would create more than one active project. Queue one in the source workspace first.');
      if(merged.filter(r=>r.kind==='focus'&&r.data.role==='primary').length>1||merged.filter(r=>r.kind==='focus'&&r.data.role==='exploration').length>2)throw new Error('The merge would exceed your focus limits. Review the source focus areas first.');
      for(const r of fresh)for(const key of ['courseId','projectId','focusId'])if(r.data[key]&&!allIds.has(String(r.data[key])))throw new Error('The import has a missing linked record. No records were changed.');
      await this.db.records.bulkPut(fresh);return {added:fresh.length,skipped:parsed.length-fresh.length};
    });
  }
  async clear() {
    await this.db.transaction(
      "rw",
      this.db.records,
      this.db.preferences,
      this.db.syncState,
      async () => {
        await this.db.records.clear();
        await this.db.preferences.clear();
        await this.db.syncState.clear();
      },
    );
  }
}
export const localDb = new LifeDB();
export const localRepo = new Repository(localDb);
