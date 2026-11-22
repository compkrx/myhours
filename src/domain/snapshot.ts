import { z } from "zod";
import {
  kinds,
  recordSchema,
  settingsSchema,
  titleOf,
  type Kind,
  type LifeRecord,
  type Preferences,
} from "./model";
export const backupSchema = z.object({
  format: z.literal("project-life-backup"),
  version: z.literal(1),
  generatedAt: z.iso.datetime(),
  preferences: settingsSchema,
  records: z.array(recordSchema).max(50000),
});
export type Backup = z.infer<typeof backupSchema>;
export function makeBackup(
  records: LifeRecord[],
  preferences: Preferences,
): Backup {
  return {
    format: "project-life-backup",
    version: 1,
    generatedAt: new Date().toISOString(),
    preferences,
    records,
  };
}
export function parseBackup(text: string) {
  if (text.length > 20_000_000) throw new Error("Backup exceeds 20 MB.");
  const backup = backupSchema.parse(JSON.parse(text));
  if (new Set(backup.records.map((r) => r.id)).size !== backup.records.length)
    throw new Error("Duplicate IDs in backup.");
  return backup;
}
export const defaultShareKinds: Kind[] = [
  "task",
  "course",
  "assignment",
  "event",
  "project",
  "focus",
];
export function makeSnapshot(
  records: LifeRecord[],
  preferences: Preferences,
  selected: Kind[],
  includePrivate = false,
) {
  const selectedSet = new Set(selected);
  const redacted = [
    "preferences",
    "teacher",
    "notes",
    "body",
    "private",
    "money unless explicitly selected",
    "private notes unless explicitly approved",
  ];
  const safe = records
    .filter(
      (r) =>
        !r.deletedAt &&
        selectedSet.has(r.kind) &&
        (r.kind !== "note" || includePrivate || r.data.private === false),
    )
    .map((r) => {
      const data = { ...r.data };
      delete data.teacher;
      delete data.notes;
      if (r.kind === "note") data.body = String(data.body || "").slice(0, 500);
      delete data.private;
      if (Array.isArray(data.relatedIds))
        data.relatedIds = data.relatedIds.filter((id) =>
          records.some(
            (other) =>
              other.id === id &&
              selectedSet.has(other.kind) &&
              (other.kind !== "note" ||
                includePrivate ||
                other.data.private === false),
          ),
        );
      return { ...r, data };
    });
  const snapshot = {
    format: "project-life-readonly-snapshot",
    version: 1,
    schema: "record envelope v1",
    generatedAt: new Date().toISOString(),
    timezone: preferences.timezone,
    generatedFrom:
      "User-selected local records; provenance is recorded per item.",
    redactedFields: redacted,
    selectedCategories: selected,
    warning:
      "Read-only snapshot. Records may have changed after export. This file does not grant automatic access to the app.",
    records: safe,
    unresolvedQuestions: [
      "Are recorded deadlines and eligibility sources still current?",
      "Which unknown grades or dates need verification?",
    ],
  };
  const markdown = [
    "# MyHours: daily routine planner · read-only snapshot",
    `Generated: ${snapshot.generatedAt} · Timezone: ${snapshot.timezone}`,
    snapshot.warning,
    `Version: 1 · Schema: ${snapshot.schema}`,
    `Categories: ${selected.join(", ") || "none"}`,
    `Redacted: ${redacted.join("; ")}`,
    ...kinds
      .filter((k) => safe.some((r) => r.kind === k))
      .flatMap((kind) => [
        `\n## ${kind}`,
        ...safe
          .filter((r) => r.kind === kind)
          .map(
            (r) =>
              `### ${titleOf(r)}\nID: ${r.id} · Source: ${r.provenance} · Updated: ${r.updatedAt}\n${Object.entries(
                r.data,
              )
                .filter(([k]) => k !== "title")
                .map(
                  ([k, v]) =>
                    `- ${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`,
                )
                .join("\n")}`,
          ),
      ]),
    "\n## Unresolved questions",
    ...snapshot.unresolvedQuestions.map((q) => `- ${q}`),
  ].join("\n\n");
  return { snapshot, markdown };
}
export function download(
  name: string,
  contents: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
