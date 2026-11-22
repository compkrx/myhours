import { isOpen, num, str, type LifeRecord, type Preferences } from "./model";
import { addDay, dayKey, dueInstant, inZone, minutesBetween } from "./time";
export interface Interval {
  start: Date;
  end: Date;
  id: string;
  title: string;
}
export interface Recommendation {
  record: LifeRecord;
  score: number;
  reasons: string[];
  blocked: boolean;
}
export function rankTasks(
  records: LifeRecord[],
  now: Date,
  tz: string,
): Recommendation[] {
  return records
    .filter(isOpen)
    .map((record) => {
      const reasons: string[] = [];
      let score = num(record, "importance", 2) * 100;
      reasons.push(
        ["", "Low", "Medium", "High"][num(record, "importance", 2)] +
          " importance",
      );
      const due = str(record, "due");
      if (due) {
        const hours = (dueInstant(due, tz).getTime() - now.getTime()) / 3600000;
        const urgency =
          hours < 0
            ? 500
            : hours < 24
              ? 400
              : hours < 72
                ? 250
                : hours < 168
                  ? 100
                  : 0;
        score += urgency + (record.data.hard ? 150 : 0);
        reasons.push(
          hours < 0
            ? "Past the recorded deadline"
            : hours < 24
              ? "Due within 24 hours"
              : "Upcoming recorded deadline",
        );
        if (record.data.hard) reasons.push("Hard deadline");
      }
      if (record.kind === "assignment") {
        score += 125;
        reasons.push("School commitment");
        if (num(record, "impact") > 0) {
          score += Math.min(200, num(record, "impact") * 10);
          reasons.push(`Recorded grade impact ${num(record, "impact")}%`);
        }
      }
      if (num(record, "priorityOrder") > 0) {
        score += 250 - num(record, "priorityOrder") * 10;
        reasons.push("Chosen priority");
      }
      const blocked =
        Array.isArray(record.data.dependencies) &&
        record.data.dependencies.some((id) =>
          records.some((r) => r.id === id && isOpen(r)),
        );
      if (blocked) {
        score -= 10000;
        reasons.push("Waiting for a dependency");
      }
      return { record, score, reasons, blocked };
    })
    .sort(
      (a, b) => b.score - a.score || a.record.sortOrder - b.record.sortOrder,
    );
}
export function expandEvents(
  records: LifeRecord[],
  day: string,
  tz: string,
): Interval[] {
  const lower = inZone(day, "00:00", tz),
    upper = inZone(addDay(day, 1), "00:00", tz);
  return records
    .filter((r) => r.kind === "event" && r.data.busy !== false)
    .flatMap((r) => {
      let start = new Date(str(r, "start")),
        end = new Date(str(r, "end"));
      const recurrence = str(r, "recurrence");
      if (recurrence && recurrence !== "none") {
        const etz = str(r, "timezone") || tz;
        const original = dayKey(start, etz);
        const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
        const sourceWeekday = new Date(`${original}T12:00:00Z`).getUTCDay();
        if (
          day < original ||
          (recurrence === "weekdays" && (weekday === 0 || weekday === 6)) ||
          (recurrence === "weekly" && weekday !== sourceWeekday)
        )
          return [];
        const clock = new Intl.DateTimeFormat("en-GB", {
          timeZone: etz,
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(start);
        const duration = end.getTime() - start.getTime();
        start = inZone(day, clock, etz);
        end = new Date(start.getTime() + duration);
      }
      const buffer = num(r, "buffer") * 60000;
      const a = new Date(start.getTime() - buffer),
        b = new Date(end.getTime() + buffer);
      return b > lower && a < upper
        ? [{ start: a, end: b, id: r.id, title: str(r, "title") }]
        : [];
    });
}
export const overlap = (a: Interval, b: Interval) =>
  a.start < b.end && b.start < a.end;
export function eventConflicts(events: Interval[]) {
  return events.flatMap((a, i) =>
    events
      .slice(i + 1)
      .filter((b) => overlap(a, b))
      .map((b) => [a, b] as const),
  );
}
export function freeIntervals(
  day: string,
  p: Preferences,
  events: Interval[],
  now?: Date,
): Interval[] {
  let start = inZone(day, p.wake, p.timezone);
  const end = inZone(day, p.bed, p.timezone);
  if (end <= start) return [];
  if (now && now > start) start = now;
  if (start >= end) return [];
  const busy = events
    .filter((e) => e.end > start && e.start < end)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  const free: Interval[] = [];
  let cursor = start;
  for (const item of busy) {
    if (item.start > cursor)
      free.push({
        start: cursor,
        end: new Date(Math.min(item.start.getTime(), end.getTime())),
        id: "free",
        title: "Available",
      });
    if (item.end > cursor) cursor = item.end;
  }
  if (cursor < end)
    free.push({ start: cursor, end, id: "free", title: "Available" });
  return free;
}
export interface DraftBlock {
  taskId: string;
  title: string;
  start: string;
  end: string;
  minutes: number;
}
export const dayModes = [
  "normal",
  "exam",
  "training",
  "job",
  "friday",
  "weekend",
  "break",
  "low-energy",
  "disruption",
] as const;
export type DayMode = (typeof dayModes)[number];
export function draftSchedule(
  records: LifeRecord[],
  day: string,
  p: Preferences,
  minimum = false,
  now = new Date(),
  mode: DayMode = "normal",
) {
  const events = expandEvents(records, day, p.timezone);
  const free = freeIntervals(
    day,
    p,
    events,
    day === dayKey(now, p.timezone) ? now : undefined,
  );
  let reserve = p.reservedMinutes;
  const spaces = free.map((e) => ({ ...e }));
  // Reserve time from the end of the day before allocating optional work.
  for (let i = spaces.length - 1; i >= 0 && reserve > 0; i--) {
    const take = Math.min(
      reserve,
      minutesBetween(spaces[i].start, spaces[i].end),
    );
    spaces[i].end = new Date(spaces[i].end.getTime() - take * 60000);
    reserve -= take;
  }
  const ranked = rankTasks(records, now, p.timezone).filter((x) => !x.blocked);
  const blocks: DraftBlock[] = [];
  const deferred: LifeRecord[] = [];
  const already = new Set(
    records
      .filter(
        (r) => r.kind === "event" && expandEvents([r], day, p.timezone).length,
      )
      .map((r) => r.data.taskId),
  );
  for (const item of ranked) {
    if (already.has(item.record.id)) continue;
    const limit =
      minimum ||
      mode === "low-energy" ||
      mode === "disruption" ||
      mode === "friday"
        ? 1
        : mode === "exam"
          ? 3
          : mode === "weekend" || mode === "break"
            ? 2
            : Infinity;
    const academicOnly = [
      "exam",
      "training",
      "job",
      "low-energy",
      "disruption",
    ].includes(mode);
    const optional =
      Boolean(item.record.data.projectId) ||
      /optional|enrichment/i.test(str(item.record, "area"));
    if (
      blocks.length >= limit ||
      (academicOnly && optional && !item.record.data.hard)
    ) {
      deferred.push(item.record);
      continue;
    }
    const minutes = Math.ceil((num(item.record, "minutes", 30) * 1.2) / 5) * 5;
    const due = str(item.record, "due");
    const deadline =
      due && item.record.data.hard ? dueInstant(due, p.timezone) : undefined;
    const space = spaces.find(
      (s) =>
        minutesBetween(s.start, s.end) >= minutes + 10 &&
        (!deadline ||
          new Date(s.start.getTime() + minutes * 60000) <= deadline),
    );
    if (!space) {
      deferred.push(item.record);
      continue;
    }
    const end = new Date(space.start.getTime() + minutes * 60000);
    blocks.push({
      taskId: item.record.id,
      title: str(item.record, "title"),
      start: space.start.toISOString(),
      end: end.toISOString(),
      minutes,
    });
    space.start = new Date(end.getTime() + 10 * 60000);
  }
  return {
    blocks,
    deferred,
    conflicts: eventConflicts(events),
    freeMinutes: Math.max(
      0,
      free.reduce((sum, s) => sum + minutesBetween(s.start, s.end), 0) -
        p.reservedMinutes,
    ),
    assumptions: `${mode} day. ${p.wake}–${p.bed} in ${p.timezone}; ${p.reservedMinutes} min reserved for meals, recovery and free time; task estimates +20%, rounded to 5 min; 10 min between work blocks. Training, jobs and school occur only if entered as actual events.`,
    unreservedMinutes: reserve,
  };
}
