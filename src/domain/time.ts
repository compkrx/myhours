import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
export const dayKey = (date: Date | string, tz: string) =>
  formatInTimeZone(date, tz, "yyyy-MM-dd");
export const todayKey = (tz: string) => dayKey(new Date(), tz);
export const inZone = (date: string, clock: string, tz: string) =>
  fromZonedTime(`${date}T${clock}:00`, tz);
export const localInput = (iso: string, tz: string) =>
  iso ? formatInTimeZone(iso, tz, "yyyy-MM-dd'T'HH:mm") : "";
export const displayDate = (s: string, tz: string) =>
  !s
    ? "No date"
    : s.length === 10
      ? new Intl.DateTimeFormat(undefined, {
          dateStyle: "medium",
          timeZone: "UTC",
        }).format(new Date(`${s}T12:00:00Z`))
      : new Intl.DateTimeFormat(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: tz,
        }).format(new Date(s));
export const dueInstant = (due: string, tz: string) =>
  due.length === 10 ? inZone(due, "23:59", tz) : new Date(due);
export const addDay = (day: string, amount: number) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + amount);
  return d.toISOString().slice(0, 10);
};
export const minutesBetween = (a: Date, b: Date) =>
  Math.max(0, Math.floor((b.getTime() - a.getTime()) / 60000));
