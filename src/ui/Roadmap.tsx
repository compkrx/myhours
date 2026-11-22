import { useState } from "react";
import { Plus, CalendarRange } from "lucide-react";
import { useApp } from "./context";
import { Button, Empty, KindTabs, RecordList, Section } from "./components";
import { str, titleOf, type Kind } from "../domain/model";
import { todayKey } from "../domain/time";
export default function Roadmap() {
  const { records, p, edit } = useApp();
  const [kind, setKind] = useState<Kind>("checkpoint");
  const [year, setYear] = useState("all");
  const [day, setDay] = useState(todayKey(p.timezone));
  const checkpoints = records
    .filter((r) => r.kind === "checkpoint")
    .sort((a, b) => str(a, "period").localeCompare(str(b, "period")));
  const years = [
    ...new Set(checkpoints.map((r) => str(r, "period").slice(0, 4))),
  ];
  const log = records.find((r) => r.kind === "daylog" && r.data.date === day);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">LONG HORIZON</div>
          <h1>The bigger picture.</h1>
          <p>Monthly direction. Actual work planned one week at a time.</p>
        </div>
        <Button onClick={() => edit(kind)}>
          <Plus size={18} />
          Add {kind === "checkpoint" ? "checkpoint" : "daily log"}
        </Button>
      </div>
      <Section
        title="A date, not a prewritten day"
        action={<CalendarRange size={20} />}
      >
        <div className="list-toolbar">
          <input
            aria-label="Roadmap daily date"
            type="date"
            value={day}
            onChange={(e) => {
              if (e.target.value) setDay(e.target.value);
            }}
          />
          <Button
            variant="secondary"
            onClick={() =>
              edit("daylog", log, { date: day, title: `Daily log · ${day}` })
            }
          >
            {log ? "Edit" : "Start"} daily log
          </Button>
        </div>
        <p className="muted">
          Record what is genuinely due, one academic action, fixed activities,
          the result and the next step. Future dates stay empty until you know
          what belongs there.
        </p>
      </Section>
      <KindTabs
        values={["checkpoint", "daylog"]}
        value={kind}
        onChange={setKind}
      />
      {kind === "checkpoint" ? (
        <>
          <div className="list-toolbar">
            <label>
              Year{" "}
              <select value={year} onChange={(e) => setYear(e.target.value)}>
                <option value="all">All years</option>
                {years.map((y) => (
                  <option key={y}>{y}</option>
                ))}
              </select>
            </label>
          </div>
          {checkpoints.length ? (
            <div className="roadmap-timeline">
              {checkpoints
                .filter(
                  (r) => year === "all" || str(r, "period").startsWith(year),
                )
                .map((r) => (
                  <article key={r.id}>
                    <div className="roadmap-period">
                      {str(r, "period")}
                      <span>
                        {str(r, "status")} ·{" "}
                        {r.data.verified ? "verified" : "dates unverified"}
                      </span>
                    </div>
                    <div>
                      <button
                        className="record-main"
                        onClick={() => edit("checkpoint", r)}
                      >
                        <h2>{titleOf(r)}</h2>
                        <p>{str(r, "main")}</p>
                        {str(r, "extra") ? (
                          <p className="hint">
                            If time permits: {str(r, "extra")}
                          </p>
                        ) : null}
                      </button>
                      <Button
                        variant="ghost"
                        onClick={() =>
                          edit("task", undefined, {
                            title: titleOf(r),
                            notes: `From proposed checkpoint ${str(r, "period")}: ${str(r, "main")}`,
                            importance: 2,
                          })
                        }
                      >
                        Draft a next action
                      </Button>
                    </div>
                  </article>
                ))}
            </div>
          ) : (
            <Empty
              title="No long-term checkpoints"
              description="Import your private plan or add an editable monthly direction."
            />
          )}
        </>
      ) : (
        <section className="panel">
          <RecordList kind="daylog" />
        </section>
      )}
      <p className="footer-note">
        Proposed checkpoints are not deadlines. Future school calendars and
        graduation dates require verification.
      </p>
    </>
  );
}
