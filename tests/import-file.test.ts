import { it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { parseBackup } from "../src/domain/snapshot";
it("validates a complete portable backup and all related IDs", async () => {
  const file =
    process.env.PRIVATE_BACKUP_TO_VALIDATE || "examples/fake-backup.json";
  const backup = parseBackup(await readFile(file, "utf8"));
  expect(backup.records.length).toBeGreaterThan(0);
  const ids = new Set(backup.records.map((r) => r.id));
  for (const r of backup.records) {
    for (const key of ["courseId", "projectId", "focusId"])
      if (r.data[key]) expect(ids.has(String(r.data[key]))).toBe(true);
    if (Array.isArray(r.data.relatedIds))
      for (const id of r.data.relatedIds) expect(ids.has(id)).toBe(true);
  }
});
