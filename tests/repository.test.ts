import { afterEach, describe, expect, it } from "vitest";
import { LifeDB, Repository, RevisionConflict } from "../src/data/repository";
import { defaultPreferences } from "../src/domain/model";
const databases: LifeDB[] = [];
function repo() {
  const db = new LifeDB(`test-${crypto.randomUUID()}`);
  databases.push(db);
  return new Repository(db);
}
afterEach(async () => {
  for (const db of databases.splice(0)) await db.delete();
});
describe("IndexedDB repository", () => {
  it("completes recurring work atomically without duplicating the next instance", async () => {
    const a = repo();
    let task = await a.save("task", {
      title: "Review",
      recurrence: "daily",
      due: "2026-11-21T18:00:00-07:00",
    });
    task = await a.complete(
      task,
      "America/Denver",
      new Date("2026-11-21T17:00:00Z"),
    );
    expect(
      (await a.list("task")).filter((r) => r.data.repeatOf === task.id),
    ).toHaveLength(1);
    task = await a.complete(task, "America/Denver");
    await a.complete(task, "America/Denver");
    expect(
      (await a.list("task")).filter((r) => r.data.repeatOf === task.id),
    ).toHaveLength(1);
  });
  it("creates, edits, completes and persists after reopening", async () => {
    const a = repo();
    const task = await a.save("task", { title: "Homework" });
    const edited = await a.save(
      "task",
      { ...task.data, title: "Math homework", status: "done" },
      task,
    );
    const name = a.db.name;
    a.db.close();
    const reopened = new LifeDB(name);
    databases.push(reopened);
    const result = await new Repository(reopened).list("task");
    expect(result[0]).toEqual(edited);
  });
  it("detects concurrent edits without silent overwrite", async () => {
    const a = repo();
    const t = await a.save("task", { title: "Original" });
    await a.save("task", { ...t.data, title: "Other tab" }, t);
    await expect(
      a.save("task", { ...t.data, title: "Stale" }, t),
    ).rejects.toBeInstanceOf(RevisionConflict);
    expect((await a.list())[0].data.title).toBe("Other tab");
  });
  it("undoes tombstones and protects referenced records", async () => {
    const a = repo();
    const c = await a.save("course", { title: "Math" });
    const assignment = await a.save("assignment", {
      title: "Worksheet",
      courseId: c.id,
    });
    await expect(a.remove(c)).rejects.toThrow("linked");
    await a.remove(assignment);
    expect(await a.list("assignment")).toHaveLength(0);
    await a.undo(assignment);
    expect(await a.list("assignment")).toHaveLength(1);
  });
  it("keeps account workspaces isolated locally", async () => {
    const a = repo(),
      b = repo();
    await a.save("note", { title: "Account A", body: "private" });
    expect(await b.list()).toHaveLength(0);
  });
  it("validates and rolls back a failed restore", async () => {
    const a = repo();
    await a.save("task", { title: "Keep me" });
    await expect(
      a.replaceAll([{ id: "invalid" } as never], defaultPreferences()),
    ).rejects.toThrow();
    expect((await a.list())[0].data.title).toBe("Keep me");
  });
  it("enforces bounded projects and focus areas", async () => {
    const a = repo();
    await a.save("project", { title: "One", status: "active" });
    await expect(
      a.save("project", { title: "Two", status: "active" }),
    ).rejects.toThrow("one major");
    await a.save("focus", {
      title: "Math",
      role: "primary",
      startDate: "2026-11-21",
    });
    await expect(
      a.save("focus", {
        title: "Writing",
        role: "primary",
        startDate: "2026-11-21",
      }),
    ).rejects.toThrow("one primary");
  });
});
