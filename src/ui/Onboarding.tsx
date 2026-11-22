import { useState } from "react";
import { useApp } from "./context";
import { Button, Modal } from "./components";
import { inZone, todayKey } from "../domain/time";
export default function Onboarding({ close }: { close: () => void }) {
  const { repo, p, setPreferences, notify } = useApp();
  const [classes, setClasses] = useState("");
  const [wake, setWake] = useState(p.wake);
  const [bed, setBed] = useState(p.bed);
  const [schoolStart, setSchoolStart] = useState("");
  const [schoolEnd, setSchoolEnd] = useState("");
  const [task, setTask] = useState("");
  const [project, setProject] = useState("");
  const [busy, setBusy] = useState(false);
  async function skip() {
    await setPreferences({ ...p, onboarded: true });
    close();
  }
  return (
    <Modal title="Set up your workspace" close={() => void skip()} wide>
      <form
        className="dialog-content settings-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await repo.db.transaction(
              "rw",
              repo.db.records,
              repo.db.preferences,
              async () => {
                for (const name of classes
                  .split(",")
                  .map((v) => v.trim())
                  .filter(Boolean))
                  await repo.save("course", { title: name });
                if (task.trim())
                  await repo.save("task", {
                    title: task,
                    importance: 3,
                    minutes: 30,
                  });
                if (project.trim())
                  await repo.save("project", {
                    title: project,
                    status: "active",
                  });
                if (schoolStart && schoolEnd) {
                  const day = todayKey(p.timezone);
                  await repo.save("event", {
                    title: "School / commute",
                    start: inZone(day, schoolStart, p.timezone).toISOString(),
                    end: inZone(day, schoolEnd, p.timezone).toISOString(),
                    timezone: p.timezone,
                    busy: true,
                    buffer: 0,
                    recurrence: "weekdays",
                    source: "manual",
                  });
                }
                await repo.setPreferences({ ...p, wake, bed, onboarded: true });
              },
            );
            close();
            notify("Workspace ready. Edit anything as your schedule changes.");
          } catch (e) {
            notify(String(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <p>
          Everything is optional. Use class names and real commitments; you can
          add the rest later.
        </p>
        <label>
          Classes, separated by commas
          <input
            value={classes}
            onChange={(e) => setClasses(e.target.value)}
            placeholder="Your current classes"
          />
        </label>
        <div className="two-columns">
          <label>
            Typical wake time
            <input
              type="time"
              value={wake}
              onChange={(e) => setWake(e.target.value)}
            />
          </label>
          <label>
            Typical bedtime
            <input
              type="time"
              value={bed}
              onChange={(e) => setBed(e.target.value)}
            />
          </label>
        </div>
        <div className="two-columns">
          <label>
            Weekday school / commute starts
            <input
              type="time"
              value={schoolStart}
              onChange={(e) => setSchoolStart(e.target.value)}
            />
          </label>
          <label>
            Ends
            <input
              type="time"
              value={schoolEnd}
              onChange={(e) => setSchoolEnd(e.target.value)}
            />
          </label>
        </div>
        <p className="hint">
          A school window repeats on weekdays. Edit it for breaks and actual
          school dates. Add sports only after you know their real times.
        </p>
        <label>
          Highest-priority school task
          <input value={task} onChange={(e) => setTask(e.target.value)} />
        </label>
        <label>
          Main active project
          <input value={project} onChange={(e) => setProject(e.target.value)} />
        </label>
        <div className="form-actions">
          <Button
            type="button"
            variant="secondary"
            onClick={() => void skip()}
            disabled={busy}
          >
            Skip setup
          </Button>
          <Button disabled={busy}>{busy ? "Saving…" : "Save and start"}</Button>
        </div>
      </form>
    </Modal>
  );
}
