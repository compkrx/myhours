import ICAL from "ical.js";
import { type LifeRecord, str, titleOf } from "../domain/model";
export interface ImportedEvent {
  title: string;
  start: string;
  end: string;
  timezone: string;
  busy: boolean;
  buffer: number;
  recurrence: "none";
  source: "ics";
  externalId: string;
  notes: string;
}
export function importICS(text: string, now = new Date()): ImportedEvent[] {
  if (text.length > 2_000_000)
    throw new Error("Calendar import is limited to 2 MB.");
  const root = new ICAL.Component(ICAL.parse(text));
  for (const zone of root.getAllSubcomponents("vtimezone")) {
    const id = zone.getFirstPropertyValue("tzid");
    if (id) ICAL.TimezoneService.register(new ICAL.Timezone(zone), String(id));
  }
  const events: ImportedEvent[] = [];
  const horizon = new Date(now.getTime() + 90 * 86400000);
  const lower = new Date(now.getTime() - 30 * 86400000);
  for (const component of root.getAllSubcomponents("vevent")) {
    const event = new ICAL.Event(component);
    if (!event.startDate) continue;
    const add = (start: ICAL.Time, end: ICAL.Time) => {
      if (events.length >= 1000)
        throw new Error("Too many occurrences. Import a smaller calendar.");
      events.push({
        title: event.summary || "Imported event",
        start: start.toJSDate().toISOString(),
        end: end.toJSDate().toISOString(),
        timezone: start.zone.tzid === "floating" ? "UTC" : start.zone.tzid,
        busy: component.getFirstPropertyValue("transp") !== "TRANSPARENT",
        buffer: 0,
        recurrence: "none",
        source: "ics",
        externalId: `ics:${event.uid}:${start.toJSDate().toISOString()}`,
        notes:
          "Imported occurrence. Repeating series are expanded only from 30 days ago through the next 90 days. Reimport to extend the window.",
      });
    };
    if (event.isRecurring()) {
      const iterator = event.iterator();
      let next: ICAL.Time | null;
      let count = 0;
      while ((next = iterator.next())) {
        if (++count > 10000)
          throw new Error("Recurrence is too large to expand safely.");
        const detail = event.getOccurrenceDetails(next);
        const start = detail.startDate.toJSDate();
        if (start > horizon) break;
        if (start >= lower) add(detail.startDate, detail.endDate);
      }
    } else {
      const end = event.endDate;
      if (end.toJSDate() <= event.startDate.toJSDate())
        throw new Error("An imported event has an invalid end time.");
      add(event.startDate, end);
    }
  }
  return events;
}
export function exportICS(records: LifeRecord[]) {
  const root = new ICAL.Component(["vcalendar", [], []]);
  root.addPropertyWithValue("version", "2.0");
  root.addPropertyWithValue("prodid", "-//MyHours//Local Calendar//EN");
  for (const r of records.filter((r) => r.kind === "event")) {
    const c = new ICAL.Component("vevent");
    c.addPropertyWithValue("uid", r.id + "@myhours");
    c.addPropertyWithValue("summary", titleOf(r));
    c.addPropertyWithValue(
      "dtstart",
      ICAL.Time.fromJSDate(new Date(str(r, "start")), true),
    );
    c.addPropertyWithValue(
      "dtend",
      ICAL.Time.fromJSDate(new Date(str(r, "end")), true),
    );
    const repeat = str(r, "recurrence");
    if (repeat && repeat !== "none")
      c.addPropertyWithValue(
        "rrule",
        ICAL.Recur.fromString(
          repeat === "weekdays"
            ? "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR"
            : repeat === "weekly"
              ? "FREQ=WEEKLY"
              : "FREQ=DAILY",
        ),
      );
    root.addSubcomponent(c);
  }
  return root.toString();
}
