import { useMemo, useState } from "react";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Download,
  Upload,
  CalendarDays,
  AlertTriangle,
  MoveUp,
  MoveDown,
  Sparkles,
} from "lucide-react";
import { useApp } from "./context";
import { Button, Empty, IconButton, Modal, Section } from "./components";
import { addDay, dayKey, displayDate, todayKey } from "../domain/time";
import {
  draftSchedule,
  eventConflicts,
  expandEvents,
  overlap,
  dayModes,
  type DayMode,
  type DraftBlock,
} from "../domain/planner";
import { str, titleOf, type Fields, type LifeRecord } from "../domain/model";
import { download } from "../domain/snapshot";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
export default function Calendar() {
  const { p, records, edit, repo, notify } = useApp();
  const [day, setDay] = useState(todayKey(p.timezone));
  const [view, setView] = useState("week");
  const [draft, setDraft] = useState<ReturnType<typeof draftSchedule>>();
  const [minimum, setMinimum] = useState(false);
  const [mode, setMode] = useState<DayMode>("normal");
  const [busy, setBusy] = useState(false);
  const [ics, setIcs] = useState<Fields[]>();
  const [move, setMove] = useState<{
    record: LifeRecord;
    start: string;
    end: string;
  }>();
  const days = useMemo(() => {
    if (view === "month") {
      const first = day.slice(0, 8) + "01";
      const weekday = new Date(first + "T12:00:00Z").getUTCDay();
      return Array.from({ length: 42 }, (_, i) => addDay(first, i - weekday));
    }
    return Array.from({ length: view === "week" ? 7 : 1 }, (_, i) =>
      addDay(day, i),
    );
  }, [day, view]);
  const allEvents = records
    .filter((r) => r.kind === "event")
    .map((r) => ({ ...r, data: { ...r.data, busy: true } }));
  const visible = days.map((d) => ({
    day: d,
    events: expandEvents(allEvents, d, p.timezone),
  }));
  const conflicts = eventConflicts(expandEvents(records, day, p.timezone));
  async function saveDraft() {
    if (!draft) return;
    setBusy(true);
    try {
      await repo.db.transaction("rw", repo.db.records, async () => {
        const latest = await repo.list();
        const current = expandEvents(latest, day, p.timezone);
        for (const block of draft.blocks) {
          if (
            current.some((e) =>
              overlap(e, {
                start: new Date(block.start),
                end: new Date(block.end),
                id: block.taskId,
                title: block.title,
              }),
            )
          )
            throw new Error(
              "Your calendar changed. Generate a fresh draft before saving.",
            );
        }
        for (const block of draft.blocks)
          await repo.save(
            "event",
            {
              title: block.title,
              start: block.start,
              end: block.end,
              timezone: p.timezone,
              busy: true,
              buffer: 5,
              recurrence: "none",
              source: "planner",
              taskId: block.taskId,
            },
            undefined,
            "AI-suggested",
          );
      });
      notify("Confirmed study blocks saved on this device.");
      setDraft(undefined);
    } catch (e) {
      notify(String(e));
    } finally {
      setBusy(false);
    }
  }
  function proposeMove(record: LifeRecord, delta: number, targetDay?: string) {
    if (str(record, "recurrence") !== "none") {
      notify(
        "Edit a recurring series in its event form. Moving one occurrence is not supported.",
      );
      return;
    }
    let start = new Date(str(record, "start"));
    const duration = new Date(str(record, "end")).getTime() - start.getTime();
    if (targetDay)
      start = fromZonedTime(
        `${targetDay}T${formatInTimeZone(start, p.timezone, "HH:mm:ss")}`,
        p.timezone,
      );
    else start = new Date(start.getTime() + delta * 60000);
    setMove({
      record,
      start: start.toISOString(),
      end: new Date(start.getTime() + duration).toISOString(),
    });
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">TIME FOR THE THINGS THAT MATTER</div>
          <h1>A realistic week.</h1>
          <p>Fixed commitments first. Flexible work where it fits.</p>
        </div>
        <Button onClick={() => edit("event")}>
          <Plus size={18} />
          Add event
        </Button>
      </div>
      <div className="calendar-tools">
        <div className="calendar-date">
          <IconButton
            label="Previous period"
            onClick={() =>
              setDay(
                addDay(day, view === "month" ? -28 : view === "week" ? -7 : -1),
              )
            }
          >
            <ChevronLeft size={18} />
          </IconButton>
          <h2>
            {new Intl.DateTimeFormat(undefined, {
              month: "long",
              year: "numeric",
              timeZone: "UTC",
            }).format(new Date(day + "T12:00:00Z"))}
          </h2>
          <IconButton
            label="Next period"
            onClick={() =>
              setDay(
                addDay(day, view === "month" ? 28 : view === "week" ? 7 : 1),
              )
            }
          >
            <ChevronRight size={18} />
          </IconButton>
          <button
            className="text-button"
            onClick={() => setDay(todayKey(p.timezone))}
          >
            Today
          </button>
        </div>
        <div className="segmented">
          {["day", "week", "month", "agenda"].map((v) => (
            <button
              key={v}
              className={view === v ? "active" : ""}
              onClick={() => setView(v)}
            >
              {v}
            </button>
          ))}
        </div>
        <input
          aria-label="Calendar date"
          type="date"
          value={day}
          onChange={(e) => {
            if (e.target.value) setDay(e.target.value);
          }}
        />
      </div>
      {conflicts.length ? (
        <div role="status" className="conflict-banner">
          <AlertTriangle size={18} />
          <div>
            <strong>
              {conflicts.length} conflict(s) on {day}
            </strong>
            <p>
              {conflicts
                .map(([a, b]) => `${a.title} overlaps ${b.title}`)
                .join("; ")}
              . Includes travel buffers.
            </p>
          </div>
        </div>
      ) : null}
      {view === "agenda" ? (
        <Section title={`Agenda · ${day}`}>
          <Agenda day={day} move={proposeMove} />
        </Section>
      ) : (
        <div className={`calendar-grid ${view}`}>
          {visible.map(({ day: d, events }) => (
            <div
              key={d}
              className={`calendar-cell ${d === todayKey(p.timezone) ? "is-today" : ""} ${d.slice(0, 7) !== day.slice(0, 7) ? "other-month" : ""}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const r = records.find(
                  (r) => r.id === e.dataTransfer.getData("text/plain"),
                );
                if (r) proposeMove(r, 0, d);
              }}
            >
              <button
                className="calendar-day"
                onClick={() => {
                  setDay(d);
                  setView("day");
                }}
              >
                <span>
                  {new Intl.DateTimeFormat(undefined, {
                    weekday: "short",
                    timeZone: "UTC",
                  }).format(new Date(d + "T12:00:00Z"))}
                </span>
                <strong>{Number(d.slice(-2))}</strong>
              </button>
              {events.map((e, i) => (
                <button
                  draggable
                  key={`${e.id}-${i}`}
                  onDragStart={(event) =>
                    event.dataTransfer.setData("text/plain", e.id)
                  }
                  className="calendar-block"
                  onClick={() => {
                    const r = records.find((r) => r.id === e.id);
                    if (r) edit("event", r);
                  }}
                >
                  <span>{formatInTimeZone(e.start, p.timezone, "HH:mm")}</span>
                  <strong>{e.title}</strong>
                </button>
              ))}
              {!events.length && view === "day" ? (
                <Empty
                  title="A little open space"
                  description="Only your recorded commitments appear here."
                />
              ) : null}
            </div>
          ))}
        </div>
      )}
      {view === "week" || view === "month" ? (
        <div className="mobile-agenda">
          <Section title={`Selected day · ${day}`}>
            <Agenda day={day} move={proposeMove} />
          </Section>
        </div>
      ) : null}
      <div className="calendar-footer">
        <div className="button-group">
          <Button
            variant="secondary"
            onClick={async () => {
              const { exportICS } = await import("../integrations/ical");
              download(
                "myhours-calendar.ics",
                exportICS(records),
                "text/calendar",
              );
              notify("Calendar export downloaded.");
            }}
          >
            <Download size={16} />
            Export .ics
          </Button>
          <label className="button secondary">
            <Upload size={16} />
            Import .ics
            <input
              className="sr-only"
              type="file"
              accept=".ics,text/calendar"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  const { importICS } = await import("../integrations/ical");
                  setIcs(importICS(await file.text()) as unknown as Fields[]);
                } catch (err) {
                  notify(String(err));
                }
                e.target.value = "";
              }}
            />
          </label>
        </div>
        <p>
          Drag to move dates, or use Agenda’s move controls. Every move requires
          confirmation.
        </p>
      </div>
      <section className="planner-panel">
        <div>
          <span className="eyebrow">
            <Sparkles size={15} />A PLAN YOU CAN EXPLAIN
          </span>
          <h2>Make the work fit the day.</h2>
          <p>Local planning rules. A preview before anything is saved.</p>
        </div>
        <div className="planner-actions">
          <label className="form-field">
            Day type
            <select
              aria-label="Planning day type"
              value={mode}
              onChange={(e) => setMode(e.target.value as DayMode)}
            >
              {dayModes.map((m) => (
                <option key={m} value={m}>
                  {m.replaceAll("-", " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              checked={minimum}
              onChange={(e) => setMinimum(e.target.checked)}
            />
            Minimum viable day · at most one task
          </label>
          <Button
            onClick={() =>
              setDraft(
                draftSchedule(records, day, p, minimum, new Date(), mode),
              )
            }
          >
            Draft {day}
          </Button>
        </div>
      </section>
      {draft ? (
        <Modal
          title="Your day · draft only"
          close={() => setDraft(undefined)}
          wide
        >
          <div className="dialog-content">
            <p>{draft.assumptions}</p>
            {draft.conflicts.length ? (
              <p className="error">
                Fixed commitments already overlap. Resolve those conflicts
                before relying on this plan.
              </p>
            ) : null}
            {draft.unreservedMinutes > 0 ? (
              <p className="error">
                The day is short of {draft.unreservedMinutes} minutes of your
                reserved rest and free time.
              </p>
            ) : null}
            {draft.blocks.length ? (
              draft.blocks.map((b: DraftBlock) => (
                <div className="draft-block" key={b.taskId}>
                  <strong>{b.title}</strong>
                  <span>
                    {displayDate(b.start, p.timezone)} · {b.minutes} min
                  </span>
                </div>
              ))
            ) : (
              <p>
                No work fits within these constraints. Deferring is a valid
                choice.
              </p>
            )}
            {draft.deferred.length ? (
              <div className="notice">
                <strong>Over capacity · consider deferring</strong>
                <ul>
                  {draft.deferred.map((r) => (
                    <li key={r.id}>{titleOf(r)}</li>
                  ))}
                </ul>
                <p>Nothing has been postponed or changed automatically.</p>
              </div>
            ) : null}
            <div className="form-actions">
              <Button variant="secondary" onClick={() => setDraft(undefined)}>
                Discard draft
              </Button>
              <Button
                disabled={
                  busy || !draft.blocks.length || draft.conflicts.length > 0
                }
                onClick={saveDraft}
              >
                {busy ? "Saving…" : "Confirm and save blocks"}
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
      {ics ? (
        <Modal title="Review calendar import" close={() => setIcs(undefined)}>
          <div className="dialog-content">
            <p>
              {ics.length} occurrence(s). Repeating series are expanded from 30
              days ago through the next 90 days. Floating times are interpreted
              as UTC. Review before importing.
            </p>
            <div className="scroll-preview">
              {ics.map((e, i) => (
                <p key={i}>
                  {String(e.title)} · {displayDate(String(e.start), p.timezone)}
                </p>
              ))}
            </div>
            <Button
              onClick={async () => {
                setBusy(true);
                try {
                  await repo.db.transaction("rw", repo.db.records, async () => {
                    const existing = new Set(
                      records.map((r) => r.data.externalId),
                    );
                    for (const data of ics)
                      if (!existing.has(data.externalId)) {
                        await repo.save("event", data, undefined, "imported");
                        existing.add(data.externalId);
                      }
                  });
                  notify("Imported calendar occurrences on this device.");
                  setIcs(undefined);
                } catch (e) {
                  notify(String(e));
                } finally {
                  setBusy(false);
                }
              }}
              disabled={busy}
            >
              Confirm import
            </Button>
          </div>
        </Modal>
      ) : null}
      {move ? (
        <Modal title="Confirm event move" close={() => setMove(undefined)}>
          <div className="dialog-content">
            <h3>{titleOf(move.record)}</h3>
            <p>From: {displayDate(str(move.record, "start"), p.timezone)}</p>
            <p>To: {displayDate(move.start, p.timezone)}</p>
            <p>
              {expandEvents(
                records.filter((r) => r.id !== move.record.id),
                dayKey(move.start, p.timezone),
                p.timezone,
              ).some((e) =>
                overlap(e, {
                  start: new Date(move.start),
                  end: new Date(move.end),
                  id: "move",
                  title: "",
                }),
              )
                ? "This move overlaps another commitment. You can save it as a visible conflict."
                : "No overlap with recorded busy commitments."}
            </p>
            <Button
              onClick={async () => {
                try {
                  await repo.save(
                    "event",
                    { ...move.record.data, start: move.start, end: move.end },
                    move.record,
                  );
                  setMove(undefined);
                  notify("Event move saved.");
                } catch (e) {
                  notify(String(e));
                }
              }}
            >
              Confirm move
            </Button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
function Agenda({
  day,
  move,
}: {
  day: string;
  move: (r: LifeRecord, d: number) => void;
}) {
  const { records, p, edit } = useApp();
  const events = expandEvents(
    records.map((r) => ({ ...r, data: { ...r.data, busy: true } })),
    day,
    p.timezone,
  ).sort((a, b) => a.start.getTime() - b.start.getTime());
  return events.length ? (
    <div className="agenda-list">
      {events.map((e, i) => {
        const record = records.find((r) => r.id === e.id)!;
        return (
          <div className="agenda-item" key={`${e.id}-${i}`}>
            <CalendarDays size={20} />
            <button
              className="record-main"
              onClick={() => edit("event", record)}
            >
              <strong>{e.title}</strong>
              <span>
                {displayDate(str(record, "start"), p.timezone)} ·{" "}
                {str(record, "source")}
                {Number(record.data.buffer) > 0 ? " · includes buffer" : ""}
              </span>
            </button>
            <IconButton
              label={`Move ${e.title} 30 minutes earlier`}
              onClick={() => move(record, -30)}
            >
              <MoveUp size={16} />
            </IconButton>
            <IconButton
              label={`Move ${e.title} 30 minutes later`}
              onClick={() => move(record, 30)}
            >
              <MoveDown size={16} />
            </IconButton>
          </div>
        );
      })}
    </div>
  ) : (
    <Empty
      title="No events recorded"
      description="Add a real commitment, or leave this space open."
    />
  );
}
