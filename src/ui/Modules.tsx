import { useState } from "react";
import Flashcards from './Flashcards';
import { Plus, Search, BookOpen } from "lucide-react";
import { useApp } from "./context";
import {
  Button,
  KindTabs,
  RecordList,
  Section,
  SourceLink,
} from "./components";
import { configs, routeKinds } from "./config";
import { calculateGrade } from "../domain/grades";
import { num, str, titleOf, type Kind } from "../domain/model";
import { addDay, displayDate } from "../domain/time";
const titles: Record<string, [string, string]> = {
  tasks: [
    "Inbox",
    "Capture it, choose a next step, then get on with your day.",
  ],
  school: [
    "School",
    "Real assignments. Known grades. A useful place to begin.",
  ],
  projects: [
    "Projects",
    "One main build. A next action you can actually take.",
  ],
  learning: ["Learning", "Choose a skill. Try a challenge. Keep the evidence."],
  life: ["Lifestyle", "Movement, recovery, friends and room to do nothing."],
  money: [
    "Money",
    "A private, manual ledger. No bank connections or predictions.",
  ],
  explore: ["Explore", "Save sources, check requirements, take a small step."],
  review: [
    "Weekly review",
    "A 15–20 minute review, without turning your week into a score.",
  ],
};
export default function Modules({ route }: { route: string }) {
  const { records, p, edit } = useApp();
  const choices = routeKinds[route] ?? ["task"];
  const [kind, setKind] = useState<Kind>(choices[0]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [view, setView] = useState("list");
  const [course, setCourse] = useState("");
  const title = titles[route] ?? titles.tasks;
  const activeKind = choices.includes(kind) ? kind : choices[0];
  const courses = records.filter((r) => r.kind === "course");
  const transactions = records.filter((r) => r.kind === "transaction");
  const income = transactions
    .filter((r) => r.data.direction === "income")
    .reduce((s, r) => s + num(r, "amount"), 0);
  const expenses = transactions
    .filter((r) => r.data.direction === "expense")
    .reduce((s, r) => s + num(r, "amount"), 0);
  const money = (n: number) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: p.currency,
    }).format(n);
  const recent = records.filter(
    (r) => r.updatedAt >= new Date(Date.now() - 7 * 86400000).toISOString(),
  );
  const primary = records.find(
    (r) => r.kind === "focus" && r.data.role === "primary",
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            YOUR WORKSPACE /{" "}
            {route === "learning" ? "EXCELLENCE TRACK" : route.toUpperCase()}
          </div>
          <h1>{title[0]}</h1>
          <p>{title[1]}</p>
        </div>
        <Button onClick={() => edit(activeKind)}>
          <Plus size={18} />
          Add {configs[activeKind].singular}
        </Button>
      </div>
      {route === "school" ? (
        <div className="school-overview">
          <div className="overview-mark">
            <BookOpen size={28} />
          </div>
          <div>
            <h3>
              {courses.length
                ? `${courses.length} course(s), one clear picture.`
                : "Start with your real classes."}
            </h3>
            <p>
              Overall grades are calculated only with known points and
              consistent category weights totaling 100%.
            </p>
          </div>
        </div>
      ) : null}
      {route === "money" ? (
        <div className="metric-row">
          <div>
            <span>Recorded income</span>
            <strong>{money(income)}</strong>
          </div>
          <div>
            <span>Recorded expenses</span>
            <strong>{money(expenses)}</strong>
          </div>
          <div>
            <span>Ledger net · not bank balance</span>
            <strong>{money(income - expenses)}</strong>
          </div>
        </div>
      ) : null}
      {route === "review" ? (
        <Section
          title="Facts from the last seven days"
          subtitle="These describe edits in this app, not everything you accomplished."
        >
          <div className="metric-row">
            <div>
              <span>Tasks marked done</span>
              <strong>
                {
                  recent.filter(
                    (r) =>
                      ["task", "assignment"].includes(r.kind) &&
                      r.data.status === "done",
                  ).length
                }
              </strong>
            </div>
            <div>
              <span>Practice attempts recorded</span>
              <strong>
                {recent.filter((r) => r.kind === "practice").length}
              </strong>
            </div>
            <div>
              <span>Notes edited</span>
              <strong>{recent.filter((r) => r.kind === "note").length}</strong>
            </div>
          </div>
        </Section>
      ) : null}
      {route === "learning" ? (
        <Section
          title="Your 90-day learning arc"
          subtitle="A guide for your chosen focus. It does not reserve extra time in your calendar."
        >
          <div className="learning-arc">
            {[
              ["Baseline", "Save something you can compare."],
              ["Fundamentals", "Attempt a bounded challenge."],
              ["Deeper task", "Apply feedback, then retest."],
              ["Review", "Notice what changed. Adjust."],
            ].map(([t, d], i) => (
              <div key={t}>
                <span className="arc-dot" />
                <h3>{t}</h3>
                <p>{d}</p>
                <small>
                  {primary
                    ? displayDate(
                        addDay(str(primary, "startDate"), [0, 14, 45, 90][i]),
                        p.timezone,
                      )
                    : "Set a focus to begin"}
                </small>
              </div>
            ))}
          </div>
          {primary ? (
            <p className="hint">
              Primary: {titleOf(primary)} ·{" "}
              {num(primary, "weeklyMinutes")
                ? `${num(primary, "weeklyMinutes")} min/week optional budget`
                : "No time budget entered"}
              . Schedule practice as a task in Calendar so it uses real
              available time.
            </p>
          ) : null}
        </Section>
      ) : null}
      {route === "life" ? (
        <div className="notice">
          <strong>Recovery belongs in the plan.</strong>
          <p>
            An 8–10 hour sleep opportunity is a default planning guideline.
            Adjust wake and bedtime in Settings. This app does not assess your
            health.
          </p>
        </div>
      ) : null}
      <KindTabs
        values={choices}
        value={activeKind}
        onChange={(k) => {
          setKind(k);
          setStatus("all");
        }}
      />
      <div className="list-toolbar">
        <label className="search-input">
          <Search size={17} />
          <input
            aria-label={`Search ${configs[activeKind].plural}`}
            placeholder={`Search ${configs[activeKind].plural.toLowerCase()}…`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        {["task", "assignment", "project"].includes(activeKind) ? (
          <select
            aria-label="Filter status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">All statuses</option>
            {(activeKind === "project"
              ? [
                  "active",
                  "queued",
                  "exploring",
                  "on-hold",
                  "completed",
                  "archived",
                ]
              : ["open", "in-progress", "submitted", "done", "excused"]
            ).map((s) => (
              <option key={s} value={s}>
                {s.replaceAll("-", " ")}
              </option>
            ))}
          </select>
        ) : null}
        {activeKind === "project" ? (
          <select
            aria-label="Project layout"
            value={view}
            onChange={(e) => setView(e.target.value)}
          >
            <option value="list">List</option>
            <option value="grid">Board cards</option>
          </select>
        ) : null}
        {activeKind === "assessment" ? (
          <select
            aria-label="Grade calculation course"
            value={course}
            onChange={(e) => setCourse(e.target.value)}
          >
            <option value="">Choose course for calculation</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {titleOf(c)}
              </option>
            ))}
          </select>
        ) : null}
      </div>
      {activeKind === 'flashcard'?<Flashcards/>:null}
      {activeKind === "assessment" && course ? (
        <GradeSummary courseId={course} />
      ) : null}
      <section className="panel collection">
        <RecordList
          kind={activeKind}
          search={search}
          view={view}
          filter={(r) =>
            (status === "all" || r.data.status === status) &&
            (activeKind !== "assessment" ||
              !course ||
              r.data.courseId === course)
          }
        />
      </section>
      {route === "money" && transactions.length ? (
        <Section title="Expenses by category">
          <div className="category-summary">
            {[
              ...new Set(
                transactions
                  .filter((r) => r.data.direction === "expense")
                  .map((r) => str(r, "category")),
              ),
            ].map((c) => (
              <div key={c}>
                <span>{c}</span>
                <strong>
                  {money(
                    transactions
                      .filter(
                        (r) =>
                          r.data.direction === "expense" &&
                          r.data.category === c,
                      )
                      .reduce((s, r) => s + num(r, "amount"), 0),
                  )}
                </strong>
              </div>
            ))}
          </div>
        </Section>
      ) : null}
      {route === "explore" ? (
        <p className="hint">
          Eligibility is unknown unless you verify it against a source. Saved
          interests and activities do not establish career qualifications.
          {records
            .filter(
              (r) =>
                ["career", "opportunity"].includes(r.kind) && str(r, "source"),
            )
            .map((r) => (
              <span key={r.id} className="source-line">
                <SourceLink href={str(r, "source")}>{titleOf(r)}</SourceLink>
              </span>
            ))}
        </p>
      ) : null}
      <p className="footer-note">
        Private on this device · No tracking · Export a backup regularly
      </p>
    </>
  );
}
function GradeSummary({ courseId }: { courseId: string }) {
  const { records } = useApp();
  const grade = calculateGrade(
    records.filter(
      (r) => r.kind === "assessment" && r.data.courseId === courseId,
    ),
  );
  return (
    <section className="grade-result">
      <strong>
        {grade.value === null
          ? "Overall grade unknown"
          : `${grade.value.toFixed(2)}%`}
      </strong>
      <p>{grade.explanation}</p>
      {grade.rows ? (
        <ul>
          {grade.rows.map((r) => (
            <li key={r.category}>
              {r.category}: {r.earned}/{r.possible} points ·{" "}
              {r.weight === undefined
                ? "weight unknown"
                : `${r.weight}% weight`}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="hint">
        This is a calculation from entered samples. It may differ from the
        official gradebook, including missing-work rules and dropped scores.
      </p>
    </section>
  );
}
