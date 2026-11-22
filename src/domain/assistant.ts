import { z } from "zod";
import {
  isOpen,
  titleOf,
  str,
  type LifeRecord,
  type Preferences,
} from "./model";
import { draftSchedule, rankTasks } from "./planner";
import { addDay, dayKey, dueInstant, todayKey } from "./time";
import { calculateGrade } from "./grades";
import { makeSnapshot } from "./snapshot";
export const toolNames = [
  "getUpcomingTasks",
  "getCourseSnapshot",
  "getAvailableTime",
  "retrieveNotes",
  "draftSchedule",
  "analyzeGradeScenario",
  "suggestProjectNextStep",
  "summarizeWeek",
  "buildShareableSnapshot",
] as const;
export const toolInputSchema = z.object({
  name: z.enum(toolNames),
  day: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  query: z.string().max(1000).optional(),
  courseId: z.uuid().optional(),
});
export function runLocalTool(
  input: unknown,
  records: LifeRecord[],
  p: Preferences,
) {
  const tool = toolInputSchema.parse(input);
  const day = tool.day ?? todayKey(p.timezone);
  switch (tool.name) {
    case "getUpcomingTasks":
      return rankTasks(records, new Date(), p.timezone).map((x) => ({
        id: x.record.id,
        title: titleOf(x.record),
        due: x.record.data.due,
        reasons: x.reasons,
      }));
    case "getCourseSnapshot":
    case "analyzeGradeScenario":
      return calculateGrade(
        records.filter(
          (r) => r.kind === "assessment" && r.data.courseId === tool.courseId,
        ),
      );
    case "getAvailableTime":
    case "draftSchedule":
      return draftSchedule(records, day, p);
    case "retrieveNotes":
      return records
        .filter(
          (r) =>
            r.kind === "note" &&
            `${titleOf(r)} ${str(r, "body")}`
              .toLowerCase()
              .includes((tool.query ?? "").toLowerCase()),
        )
        .slice(0, 10)
        .map((r) => ({
          id: r.id,
          title: titleOf(r),
          excerpt: str(r, "body").slice(0, 500),
        }));
    case "suggestProjectNextStep":
      return records
        .filter((r) => r.kind === "project" && r.data.status === "active")
        .map((r) => ({
          id: r.id,
          nextAction: r.data.nextAction ?? "Next action not recorded.",
        }));
    case "summarizeWeek":
      return {
        completed: records
          .filter(
            (r) =>
              ["task", "assignment"].includes(r.kind) &&
              r.data.status === "done" &&
              r.updatedAt >= new Date(Date.now() - 7 * 86400000).toISOString(),
          )
          .map((r) => ({ id: r.id, title: titleOf(r) })),
        unknown: "The log cannot prove what happened outside this app.",
      };
    case "buildShareableSnapshot":
      return makeSnapshot(records, p, [
        "task",
        "assignment",
        "course",
        "project",
        "event",
      ]);
  }
}
export interface LocalAnswer {
  text: string;
  references: string[];
  type: "local";
}
export function localAnswer(
  query: string,
  records: LifeRecord[],
  p: Preferences,
): LocalAnswer {
  const q = query.toLowerCase();
  let relevant: LifeRecord[] = [];
  let text = "";
  if (/overdue|late/.test(q)) {
    relevant = records.filter(
      (r) =>
        isOpen(r) &&
        str(r, "due") &&
        dueInstant(str(r, "due"), p.timezone) < new Date(),
    );
    text = relevant.length
      ? `${relevant.length} open item(s) are past their recorded deadline: ${relevant.map(titleOf).join(", ")}. Submission or excusal may need verification.`
      : "No open items with a past recorded deadline were found in your approved context.";
  } else if (/week|changed/.test(q)) {
    relevant = records.filter(
      (r) => r.updatedAt >= new Date(Date.now() - 7 * 86400000).toISOString(),
    );
    text = relevant.length
      ? `${relevant.length} approved record(s) were edited in the last seven days. Open the references to review them.`
      : "There are no recent edits in this approved context.";
  } else if (/skill|practice|mastery|challenge/.test(q)) {
    relevant = records.filter((r) =>
      ["focus", "practice", "evidence"].includes(r.kind),
    );
    const focus = relevant.find(
      (r) => r.kind === "focus" && r.data.role === "primary",
    );
    const practice = relevant.find((r) => r.kind === "practice");
    text =
      !focus || !practice
        ? "I cannot assess mastery yet. Add a focus, a baseline artifact and a practice attempt with feedback."
        : `Draft challenge for ${titleOf(focus)}: revisit your recorded correction (${str(practice, "correction") || "no correction recorded yet"}), attempt one bounded variation, and compare the result with your baseline. This is a local rule-based suggestion, not a mastery assessment.`;
  } else if (/project/.test(q)) {
    relevant = records.filter(
      (r) => r.kind === "project" && r.data.status === "active",
    );
    text = relevant.length
      ? `Your recorded next action: ${str(relevant[0], "nextAction") || "No next action entered yet."}`
      : "No active project is recorded in this context.";
  } else if (/study|algebra|math|explain/.test(q)) {
    relevant = records.filter((r) =>
      ["mistake", "study", "note"].includes(r.kind),
    );
    text =
      "The hosted tutor is not connected. You can record a mistake and correction in Learning, or connect the protected model gateway for explanations and practice questions. I cannot assess your mastery from these records.";
  } else {
    const ranked = rankTasks(records, new Date(), p.timezone).filter(
      (r) => !r.blocked,
    );
    const best = ranked[0];
    relevant = best ? [best.record] : [];
    text = best
      ? `A useful next step is “${titleOf(best.record)}”. Why: ${best.reasons.join("; ")}. Estimated effort: ${best.record.data.minutes} minutes before buffer. Use Draft day to check whether it fits.`
      : "There are no actionable tasks in your approved context. Capture a real commitment or leave the space open.";
  }
  return { text, references: relevant.map((r) => r.id), type: "local" };
}
export function parseCapture(text: string, p: Preferences, now = new Date()) {
  let title = text.trim();
  let due: string | undefined;
  let ambiguous = false;
  const today = dayKey(now, p.timezone);
  if (/\bdue today\b/i.test(title)) {
    due = today;
    title = title.replace(/\bdue today\b/i, "");
  } else if (/\bdue tomorrow\b/i.test(title)) {
    due = addDay(today, 1);
    title = title.replace(/\bdue tomorrow\b/i, "");
  } else {
    const match = title.match(/\bdue (\d{4}-\d{2}-\d{2})\b/i);
    if (match) {
      due = match[1];
      title = title.replace(match[0], "");
    } else if (/\bdue\b/i.test(title)) ambiguous = true;
  }
  return { title: title.trim(), due, ambiguous, parsedAt: now.toISOString() };
}
export const hostedAnswerSchema = z.object({
  text: z.string().min(1).max(12000),
  claims: z
    .array(
      z.object({
        text: z.string().max(2000),
        references: z.array(z.uuid()).min(1),
      }),
    )
    .max(30),
  suggestions: z
    .array(
      z.object({
        type: z.literal("task"),
        title: z.string().min(1).max(240),
        minutes: z.number().int().min(5).max(240),
        references: z.array(z.uuid()),
      }),
    )
    .max(5),
  usage: z
    .object({ requests: z.number(), limit: z.number(), costKnown: z.boolean() })
    .optional(),
});
