import { useState } from "react";
import {
  Plus,
  Sun,
  CalendarDays,
  Sparkles,
  Check,
  Leaf,
  Flag,
  BookOpen,
  Folder,
  SlidersHorizontal,
} from "lucide-react";
import { useApp } from "./context";
import {
  Button,
  Empty,
  IconButton,
  Modal,
  PriorityControls,
  RecordCard,
  Section,
} from "./components";
import { isOpen, num, str, titleOf } from "../domain/model";
import { displayDate, dueInstant, todayKey } from "../domain/time";
import { draftSchedule, expandEvents, rankTasks } from "../domain/planner";

export default function Today() {
  const { records, p, edit, navigate, repo, notify } = useApp();
  const [choose, setChoose] = useState(false);
  const [shutdown, setShutdown] = useState(false);
  const [checked, setChecked] = useState<string[]>([]);
  const now = new Date();
  const today = todayKey(p.timezone);
  const ranked = rankTasks(records, now, p.timezone);
  const chosen = ranked
    .filter((x) => num(x.record, "priorityOrder") > 0)
    .sort(
      (a, b) => num(a.record, "priorityOrder") - num(b.record, "priorityOrder"),
    )
    .slice(0, 3)
    .map((x) => x.record);
  const priorities = chosen.length
    ? chosen
    : ranked
        .filter((x) => !x.blocked)
        .slice(0, 3)
        .map((x) => x.record);
  const next = records
    .filter((r) => isOpen(r) && str(r, "due"))
    .sort(
      (a, b) =>
        dueInstant(str(a, "due"), p.timezone).getTime() -
        dueInstant(str(b, "due"), p.timezone).getTime(),
    )[0];
  const events = expandEvents(records, today, p.timezone);
  const plan = draftSchedule(records, today, p);
  const project = records.find(
    (r) => r.kind === "project" && r.data.status === "active",
  );
  const courseCount = records.filter((r) => r.kind === "course").length;
  const graded = records.filter(
    (r) => r.kind === "assessment" && r.data.status === "graded",
  ).length;
  const reported = records.filter(
    (r) => r.kind === "course" && r.data.reportedGrade !== undefined,
  ).length;
  const nextRank = ranked.find((r) => !r.blocked);
  const date = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: p.timezone,
  }).format(now);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <Sun size={15} />
            {date}
          </div>
          <h1 className="today-title">
            Today<span>.</span>
          </h1>
          <p>Your priorities, commitments and next action.</p>
        </div>
        <Button onClick={() => edit("task")}>
          <Plus size={18} />
          Quick capture
        </Button>
      </div>
      <div className="today-layout">
        <div className="today-main">
          <section className="focus-banner">
            <div className="eyebrow">LOCAL RECOMMENDATION / DRAFT</div>
            <h2>
              {nextRank ? titleOf(nextRank.record) : "No priorities selected."}
            </h2>
            <p>
              {nextRank
                ? nextRank.reasons.join(" · ")
                : "Add a real task or choose up to three priorities. Nothing is scheduled automatically."}
            </p>
            <div className="banner-bottom">
              <span>
                <span className="tiny-line" />
                PRIVATE WORKSPACE / LOCAL STORAGE
              </span>
              <Leaf size={26} strokeWidth={1.3} />
            </div>
            <div className="banner-date" aria-hidden="true">
              <span>
                {new Intl.DateTimeFormat("en", {
                  month: "short",
                  timeZone: p.timezone,
                })
                  .format(now)
                  .toUpperCase()}
              </span>
              <strong>
                {new Intl.DateTimeFormat("en", {
                  day: "2-digit",
                  timeZone: p.timezone,
                }).format(now)}
              </strong>
              <span>{now.getFullYear()}</span>
            </div>
          </section>
          <Section
            title="Your three priorities"
            subtitle={
              chosen.length
                ? "Chosen by you. Adjust as life changes."
                : "Suggested from your recorded commitments."
            }
            action={
              <IconButton
                label="Choose priorities"
                onClick={() => setChoose(true)}
              >
                <SlidersHorizontal size={18} />
              </IconButton>
            }
          >
            <div className="priority-list">
              {priorities.length ? (
                priorities.map((r, i) => (
                  <div key={r.id} className="priority-row">
                    <span className="priority-number">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <RecordCard record={r} compact />
                    {chosen.length ? (
                      <PriorityControls record={r} index={i} ordered={chosen} />
                    ) : null}
                  </div>
                ))
              ) : (
                <Empty
                  title="What matters today?"
                  description="Choose up to three priorities. A short list is enough."
                  action={
                    <Button variant="secondary" onClick={() => edit("task")}>
                      <Plus size={16} />
                      Add your first task
                    </Button>
                  }
                />
              )}
            </div>
          </Section>
          <div className="two-columns">
            <Section
              title="School"
              action={
                <button
                  className="text-button"
                  onClick={() => navigate("school")}
                >
                  Open school
                </button>
              }
            >
              <div className="insight-icon">
                <BookOpen size={22} />
              </div>
              <h3>
                {courseCount
                  ? `${courseCount} course${courseCount === 1 ? "" : "s"} in your workspace`
                  : "No courses added"}
              </h3>
              <p className="muted">
                {graded
                  ? `${graded} graded assessment(s) recorded. View each course for the calculation.`
                  : reported
                    ? `${reported} dated grade snapshot(s). Verify them against your current gradebook.`
                    : "Grades not entered. Add verified points when you have them."}
              </p>
              <p className="small-line">
                {
                  records.filter((r) => r.kind === "assignment" && isOpen(r))
                    .length
                }{" "}
                open assignments
              </p>
            </Section>
            <Section
              title="One active build"
              action={
                <button
                  className="text-button"
                  onClick={() => navigate("projects")}
                >
                  Open projects
                </button>
              }
            >
              <div className="insight-icon warm">
                <Folder size={22} />
              </div>
              <h3>{project ? titleOf(project) : "No active project"}</h3>
              <p className="muted">
                {project
                  ? str(project, "nextAction") ||
                    "Add one concrete next action."
                  : "Keep one main project active. Save the rest in your parking lot."}
              </p>
              {!project ? (
                <button
                  className="text-button"
                  onClick={() =>
                    edit("project", undefined, { status: "active" })
                  }
                >
                  Choose a project
                </button>
              ) : null}
            </Section>
          </div>
          <section className="assistant-strip">
            <span className="ai-icon">
              <Sparkles size={22} />
            </span>
            <div>
              <h3>
                A grounded next step{" "}
                <span className="tag">Local suggestion · draft</span>
              </h3>
              <p>
                {nextRank
                  ? `${titleOf(nextRank.record)} — ${nextRank.reasons.join("; ")}.`
                  : "Add a real task to get a recommendation based on your records."}
              </p>
              {nextRank ? (
                <button
                  className="text-button"
                  onClick={() => edit(nextRank.record.kind, nextRank.record)}
                >
                  View evidence
                </button>
              ) : null}
            </div>
            <IconButton
              label="Open MyHours AI"
              onClick={() => navigate("ai")}
            >
              <Sparkles size={19} />
            </IconButton>
          </section>
        </div>
        <aside aria-label="Today context" className="today-aside">
          <Section title="Available time" className="breathing">
            <div className="time-estimate">
              {Math.floor(plan.freeMinutes / 60)}
              <span>h</span> {plan.freeMinutes % 60}
              <span>m</span>
            </div>
            <p>Estimated unallocated time for flexible work.</p>
            <details>
              <summary>See the assumptions</summary>
              <p>{plan.assumptions}</p>
              <p>
                This excludes unrecorded commitments. Your estimate is only as
                complete as your calendar.
              </p>
            </details>
            <Button variant="secondary" onClick={() => navigate("calendar")}>
              Draft a realistic day
            </Button>
          </Section>
          <Section title="On your calendar" action={<CalendarDays size={18} />}>
            <p className="section-caption">TODAY’S FIXED COMMITMENTS</p>
            {events.length ? (
              <div className="timeline">
                {events
                  .sort((a, b) => a.start.getTime() - b.start.getTime())
                  .map((e, i) => (
                    <button
                      key={`${e.id}-${i}`}
                      className="timeline-event"
                      onClick={() => {
                        const r = records.find((r) => r.id === e.id);
                        if (r) edit("event", r);
                      }}
                    >
                      <span>
                        {new Intl.DateTimeFormat(undefined, {
                          hour: "numeric",
                          minute: "2-digit",
                          timeZone: p.timezone,
                        }).format(e.start)}
                      </span>
                      <strong>{e.title}</strong>
                    </button>
                  ))}
              </div>
            ) : (
              <p className="muted">
                No fixed commitments recorded today. Add school, practice or
                plans to make the estimate useful.
              </p>
            )}
            {plan.conflicts.length ? (
              <p className="error">
                {plan.conflicts.length} overlapping commitment(s). Review
                Calendar.
              </p>
            ) : null}
            <button className="text-button" onClick={() => edit("event")}>
              <Plus size={14} />
              Add commitment
            </button>
          </Section>
          <Section title="Nearest deadline" action={<Flag size={18} />}>
            {next ? (
              <>
                <h3>{titleOf(next)}</h3>
                <p className="deadline-date">
                  {displayDate(str(next, "due"), p.timezone)}
                </p>
                <p className="muted">
                  {next.data.hard ? "Hard deadline" : "Flexible deadline"} ·{" "}
                  {next.provenance}
                </p>
              </>
            ) : (
              <p className="muted">
                No deadlines entered. We won’t invent one.
              </p>
            )}
          </Section>
          <button className="shutdown-button" onClick={() => setShutdown(true)}>
            <Check size={17} />
            End-of-day checklist
          </button>
        </aside>
      </div>
      {choose ? (
        <Modal
          title="Choose up to three priorities"
          close={() => setChoose(false)}
        >
          <div className="dialog-content">
            <p>
              Use each task’s priority field to order it. Clearing a priority
              does not delete the task.
            </p>
            {records.filter(isOpen).map((r) => (
              <label className="priority-choice" key={r.id}>
                <span>{titleOf(r)}</span>
                <select
                  aria-label={`Priority for ${titleOf(r)}`}
                  value={num(r, "priorityOrder")}
                  onChange={async (e) => {
                    try {
                      await repo.save(
                        r.kind,
                        { ...r.data, priorityOrder: Number(e.target.value) },
                        r,
                      );
                    } catch (err) {
                      notify(String(err));
                    }
                  }}
                >
                  {[0, 1, 2, 3].map((n) => (
                    <option key={n} value={n}>
                      {n === 0 ? "Not today" : `Priority ${n}`}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            {!records.some(isOpen) ? (
              <p className="muted">Add a task first.</p>
            ) : null}
            <Button onClick={() => setChoose(false)}>Done</Button>
          </div>
        </Modal>
      ) : null}
      {shutdown ? (
        <Modal title="Let the day be enough" close={() => setShutdown(false)}>
          <div className="dialog-content">
            <p>A temporary checklist. No streaks, no score.</p>
            {[
              "Check tomorrow’s real commitments",
              "Choose what can wait",
              "Leave time for sleep",
              "Do something restful",
            ].map((item) => (
              <label key={item} className="check-label">
                <input
                  type="checkbox"
                  checked={checked.includes(item)}
                  onChange={(e) =>
                    setChecked((c) =>
                      e.target.checked
                        ? [...c, item]
                        : c.filter((x) => x !== item),
                    )
                  }
                />
                {item}
              </label>
            ))}
            <Button onClick={() => setShutdown(false)}>Close the day</Button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
