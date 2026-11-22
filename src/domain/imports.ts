import { dataSchemas, type Fields, type Kind, type LifeRecord } from "./model";
export type ImportTarget =
  "course" | "assignment" | "task" | "assessment" | "event";
export interface ImportDraft {
  kind: Kind;
  data: Fields;
  state: "new" | "duplicate" | "changed" | "invalid";
  message: string;
  existingId?: string;
}
export function parseCSV(text: string): string[][] {
  if (text.length > 2_000_000)
    throw new Error("CSV files are limited to 2 MB.");
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (quoted || !cell) quoted = !quoted;
      else throw new Error("Unexpected quote in CSV.");
    } else if (c === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((v) => v.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
    if (rows.length > 2000)
      throw new Error("Import at most 2,000 rows at once.");
  }
  if (quoted) throw new Error("An opening CSV quote has no closing quote.");
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  if (!rows.length) throw new Error("CSV is empty.");
  rows[0][0] = rows[0][0].replace(/^\uFEFF/, "");
  return rows;
}
export const importFields: Record<ImportTarget, string[]> = {
  course: [
    "title",
    "period",
    "teacher",
    "reportedGrade",
    "gradeAsOf",
    "externalId",
  ],
  assignment: [
    "title",
    "course",
    "due",
    "minutes",
    "importance",
    "status",
    "externalId",
  ],
  task: [
    "title",
    "due",
    "minutes",
    "importance",
    "status",
    "area",
    "externalId",
  ],
  assessment: [
    "title",
    "course",
    "category",
    "earned",
    "possible",
    "weight",
    "status",
    "externalId",
  ],
  event: ["title", "start", "end", "timezone", "buffer", "externalId"],
};
const aliases: Record<string, string[]> = {
  title: [
    "title",
    "name",
    "assignment",
    "assignmentname",
    "classname",
    "coursename",
    "summary",
  ],
  course: ["course", "class", "coursename", "classname"],
  due: ["due", "duedate", "duedatetime", "deadline"],
  start: ["start", "starts", "startdatetime", "dtstart"],
  end: ["end", "ends", "enddatetime", "dtend"],
  externalId: ["externalid", "sourcedid", "id", "assignmentid"],
  period: ["period", "classcode"],
  reportedGrade: ["reportedgrade", "grade", "percent", "percentage"],
  gradeAsOf: ["gradeasof", "asof", "snapshotdate"],
};
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
export function suggestMapping(headers: string[], target: ImportTarget) {
  return Object.fromEntries(
    importFields[target].map((key) => [
      key,
      headers.findIndex((h) => (aliases[key] ?? [key]).includes(norm(h))),
    ]),
  );
}
async function sourceKey(source: string, kind: string, data: Fields) {
  const identity = data.externalId
    ? String(data.externalId)
    : JSON.stringify([data.title, data.courseId, data.due, data.start]);
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${source}|${kind}|${identity}`),
  );
  return (
    "import:" +
    Array.from(new Uint8Array(bytes))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}
export async function previewCSV(
  rows: string[][],
  target: ImportTarget,
  mapping: Record<string, number>,
  records: LifeRecord[],
  timezone: string,
  source = "school-file",
): Promise<ImportDraft[]> {
  const drafts: ImportDraft[] = [];
  for (const row of rows.slice(1)) {
    const data: Fields = {};
    for (const key of importFields[target]) {
      const index = mapping[key];
      const value = index >= 0 ? row[index]?.trim() : undefined;
      if (value !== undefined && value !== "")
        data[key] = [
          "minutes",
          "importance",
          "earned",
          "possible",
          "weight",
          "reportedGrade",
          "buffer",
        ].includes(key)
          ? Number(value.replace(/%$/, ""))
          : value;
    }
    if (target === "assignment" || target === "assessment") {
      const name = String(data.course || "");
      delete data.course;
      const found = records.find(
        (r) =>
          r.kind === "course" &&
          String(r.data.title).toLowerCase() === name.toLowerCase(),
      );
      if (found) data.courseId = found.id;
      else {
        drafts.push({
          kind: target,
          data,
          state: "invalid",
          message: `Course “${name || "not specified"}” must be imported or created first.`,
        });
        continue;
      }
    }
    if (target === "event") {
      data.timezone ||= timezone;
      data.busy = true;
      data.source = "manual";
      data.recurrence = "none";
      data.buffer ??= 0;
    }
    if (target === "assessment")
      data.status ||=
        data.earned !== undefined && data.possible !== undefined
          ? "graded"
          : "ungraded";
    if (target === "course" && data.reportedGrade !== undefined) {
      data.gradeVerified = false;
      data.gradeSource = `Imported from ${source}; verify against the current portal.`;
    }
    const rawId = data.externalId;
    data.externalId = await sourceKey(source, target, data);
    if (rawId) data.notes = `Source record ID: ${String(rawId)}`;
    const parsed = dataSchemas[target].safeParse(data);
    if (!parsed.success) {
      drafts.push({
        kind: target,
        data,
        state: "invalid",
        message: parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      });
      continue;
    }
    const clean = parsed.data as Fields;
    const existing = records.find(
      (r) => r.kind === target && r.data.externalId === clean.externalId,
    );
    const changed =
      existing &&
      Object.entries(clean).some(
        ([key, value]) =>
          JSON.stringify(existing.data[key]) !== JSON.stringify(value),
      );
    drafts.push({
      kind: target,
      data: clean,
      state: existing ? (changed ? "changed" : "duplicate") : "new",
      existingId: existing?.id,
      message: existing
        ? changed
          ? "Existing source ID has different values. Open the original to review; it will not be overwritten."
          : "Already imported; skipped."
        : "Ready for review.",
    });
  }
  return drafts;
}
