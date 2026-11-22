import { useEffect, useState } from "react";
import { Check, ClipboardCheck, RotateCcw } from "lucide-react";
import { todayKey } from "../domain/time";
import {
  routineStepId,
  starterRoutines,
  stepsFromPlan,
  week,
  weekdayForDate,
  type Weekday,
} from "../domain/routines";
import { str } from "../domain/model";
import { Button, Section } from "./components";
import { useApp } from "./context";

export default function Routines() {
  const { records, repo, p, notify } = useApp();
  const today = todayKey(p.timezone);
  const todayDay = weekdayForDate(today);
  const [day, setDay] = useState<Weekday>(todayDay);
  const [draft, setDraft] = useState(starterRoutines[todayDay]);
  const [saving, setSaving] = useState(false);
  const [savingStep, setSavingStep] = useState("");
  const templates = records.filter((record) => record.kind === "routine");
  const template = templates.find((record) => record.data.day === day);
  const steps = stepsFromPlan(draft);
  const checks = records.filter(
    (record) =>
      record.kind === "routineCheck" &&
      record.data.date === today &&
      record.data.day === day,
  );
  const checkedIds = new Set(checks.map((record) => str(record, "stepId")));
  const checkedCount = steps.filter((step, index) =>
    checkedIds.has(routineStepId(index, step)),
  ).length;
  const isToday = day === todayDay;

  useEffect(() => {
    setDraft(
      template ? str(template, "plan") : starterRoutines[day],
    );
  }, [day, template?.updatedAt]);

  async function saveTemplate() {
    setSaving(true);
    try {
      await repo.save(
        "routine",
        {
          title: `${week.find((item) => item.id === day)?.label} routine`,
          day,
          frequency: "Weekly template",
          plan: draft,
          notes: "A reusable guide only. Add actual fixed commitments to Calendar.",
        },
        template,
      );
      notify(`${week.find((item) => item.id === day)?.label} routine saved.`);
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  }

  async function toggleStep(index: number, step: string) {
    const stepId = routineStepId(index, step);
    const existing = checks.find((record) => str(record, "stepId") === stepId);
    setSavingStep(stepId);
    try {
      if (existing) {
        await repo.remove(existing);
      } else {
        await repo.save("routineCheck", {
          title: step,
          date: today,
          day,
          stepId,
          step,
          completed: true,
        });
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error));
    } finally {
      setSavingStep("");
    }
  }

  const label = week.find((item) => item.id === day)?.label ?? "Today";
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">WEEK / ROUTINES</div>
          <h1>A rhythm that fits.</h1>
          <p>
            Seven editable day plans. Starter text has no assumed school or
            training times, and saving a routine never adds calendar events.
          </p>
        </div>
        <ClipboardCheck size={28} aria-hidden="true" />
      </div>

      <nav className="routine-days" aria-label="Choose a day">
        {week.map((item) => {
          const hasSavedTemplate = templates.some(
            (record) => record.data.day === item.id,
          );
          return (
            <button
              key={item.id}
              type="button"
              className={day === item.id ? "active" : ""}
              aria-pressed={day === item.id}
              onClick={() => setDay(item.id)}
            >
              <span>{item.short}</span>
              <small>
                {item.id === todayDay
                  ? "Today"
                  : hasSavedTemplate
                    ? "Saved"
                    : "Starter"}
              </small>
            </button>
          );
        })}
      </nav>

      <div className="routine-layout">
        <Section
          title={`${label}${isToday ? " · today" : ""}`}
          subtitle={
            isToday
              ? `${checkedCount} of ${steps.length} steps checked today.`
              : "Preview or edit this day. Check-offs are available on the matching day."
          }
          action={<Check size={18} aria-hidden="true" />}
        >
          {steps.length ? (
            <ol className="routine-checklist">
              {steps.map((step, index) => {
                const stepId = routineStepId(index, step);
                const checked = checkedIds.has(stepId);
                return (
                  <li key={stepId} className={checked ? "checked" : ""}>
                    {isToday ? (
                      <button
                        type="button"
                        className="routine-check"
                        aria-label={`${checked ? "Uncheck" : "Complete"}: ${step}`}
                        aria-pressed={checked}
                        disabled={savingStep === stepId}
                        onClick={() => void toggleStep(index, step)}
                      >
                        {checked ? <Check size={15} /> : null}
                      </button>
                    ) : (
                      <span className="routine-step-number">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                    )}
                    <span>{step}</span>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="muted">Add a few lines below to build this day.</p>
          )}
          {!isToday ? (
            <p className="hint">
              Routine completion is stored by date. You can still review or
              rewrite this day&apos;s reusable template.
            </p>
          ) : null}
        </Section>

        <Section
          title="Edit the template"
          subtitle="One action per line. Keep it flexible and specific enough to help."
        >
          <label className="routine-editor-label" htmlFor="routine-plan">
            {label} checklist
          </label>
          <textarea
            id="routine-plan"
            rows={11}
            maxLength={10000}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <div className="routine-actions">
            <Button onClick={() => void saveTemplate()} disabled={saving}>
              {saving ? "Saving…" : template ? "Save changes" : "Save this day"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => setDraft(starterRoutines[day])}
            >
              <RotateCcw size={15} /> Use starter text
            </Button>
          </div>
          <p className="hint">
            The calendar remains the source of truth for school, travel,
            training, meals, and other fixed commitments.
          </p>
        </Section>
      </div>
    </>
  );
}
