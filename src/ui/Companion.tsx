import { useState } from "react";
import { ArrowUpRight, EyeOff, Footprints, Pause, Send } from "lucide-react";
import { localAnswer } from "../domain/assistant";
import { titleOf, type Kind } from "../domain/model";
import { requestAI } from "../integrations/ai";
import { Button, Modal } from "./components";
import { useApp } from "./context";
import "./companion.css";

const companionScope: Kind[] = ["task", "assignment", "event", "project"];
const suggestedQuestions = [
  "What should I do now?",
  "What is overdue?",
  "What is my next project step?",
];

function Rover({ alert = false }: { alert?: boolean }) {
  return (
    <svg
      className="companion-rover"
      viewBox="0 0 64 54"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M18 23 8 17l-2 8 10 8m30-7 11-6 2 7-10 8"
        fill="var(--accent)"
        stroke="var(--bg)"
        strokeWidth="2"
      />
      <path
        d="M30 12V6l7-3"
        stroke="var(--accent)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="38" cy="3" r="2.5" fill="var(--accent)" />
      <path
        className="companion-foot companion-foot-left"
        d="M23 39v8h-6"
        stroke="var(--accent)"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        className="companion-foot companion-foot-right"
        d="M42 39v8h6"
        stroke="var(--accent)"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <rect
        x="14"
        y="11"
        width="37"
        height="32"
        rx="10"
        fill="var(--accent)"
        stroke="var(--bg)"
        strokeWidth="2"
      />
      <rect x="19" y="16" width="27" height="17" rx="6" fill="#111a1d" />
      <path
        className={alert ? "companion-eyes alert" : "companion-eyes"}
        d={alert ? "m24 24 3-3 3 3m6 0 3-3 3 3" : "M27 22v4m12-4v4"}
        stroke="#bce9de"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M28 38h9"
        stroke="#111a1d"
        strokeWidth="2"
        strokeLinecap="round"
        opacity=".45"
      />
    </svg>
  );
}

export default function Companion({ paused = false }: { paused?: boolean }) {
  const { p, records, repo } = useApp();
  if (!p.petEnabled) return null;
  return (
    <CompanionControls
      key={repo.db.name}
      paused={paused}
      recordCount={records.length}
    />
  );
}

function CompanionControls({
  paused,
  recordCount,
}: {
  paused: boolean;
  recordCount: number;
}) {
  const { p, records, edit, navigate, setPreferences, notify } = useApp();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"local" | "hosted">("local");
  const [shareRecords, setShareRecords] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [answer, setAnswer] = useState<{
    text: string;
    references: string[];
    mode: "local" | "hosted";
  }>();
  const availableRecords = records
    .filter((record) => companionScope.includes(record.kind))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 20);

  function close() {
    setOpen(false);
    setConsent(false);
  }

  async function savePreference(next: {
    petEnabled?: boolean;
    petWalking?: boolean;
  }) {
    try {
      await setPreferences({ ...p, ...next });
      if (next.petEnabled === false)
        notify(
          `${p.petName} hidden. You can bring the companion back in Appearance.`,
        );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }

  async function ask(question: string) {
    const text = question.trim();
    if (busy || !text) return;
    setStatus("");
    if (mode === "local") {
      const result = localAnswer(text, availableRecords, p);
      setAnswer({ text: result.text, references: result.references, mode });
      return;
    }
    if (!consent) return;
    setBusy(true);
    setConsent(false);
    try {
      const result = await requestAI({
        query: text,
        records: shareRecords ? availableRecords : [],
        scope: shareRecords ? companionScope : [],
        timezone: p.timezone,
      });
      setAnswer({
        mode,
        text: [result.text, ...result.claims.map((claim) => claim.text)]
          .filter(Boolean)
          .join("\n\n"),
        references: Array.from(
          new Set(result.claims.flatMap((claim) => claim.references)),
        ),
      });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div
        className="companion-rail"
        data-walking={!paused && !open && p.petWalking ? "on" : "off"}
      >
        <div className="companion-roam">
          <button
            className="companion-trigger"
            type="button"
            onClick={() => setOpen(true)}
            aria-label={`Ask ${p.petName}`}
            aria-haspopup="dialog"
            title={`Ask ${p.petName}`}
          >
            <Rover alert={open || !!answer} />
          </button>
        </div>
      </div>
      {open ? (
        <Modal title={`Ask ${p.petName}`} close={close}>
          <div className="dialog-content companion-dialog">
            <div className="companion-greeting">
              <Rover alert />
              <p>
                {recordCount
                  ? "Need help picking your next step?"
                  : "Settle in. I’m here when you need a hand."}
              </p>
            </div>
            <label className="companion-mode">
              Answer mode
              <select
                value={mode}
                disabled={busy}
                onChange={(event) => {
                  setMode(event.target.value === "hosted" ? "hosted" : "local");
                  setConsent(false);
                  setStatus("");
                }}
              >
                <option value="local">Local planner</option>
                <option value="hosted">Hosted AI</option>
              </select>
            </label>
            {mode === "local" ? (
              <>
                <p className="hint">
                  Uses up to 20 recent tasks, assignments, events and projects
                  on this device.
                </p>
                <div className="companion-prompts">
                  {suggestedQuestions.map((question) => (
                    <Button
                      key={question}
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setQuery(question);
                        void ask(question);
                      }}
                    >
                      {question}
                    </Button>
                  ))}
                </div>
              </>
            ) : (
              <div className="companion-permissions">
                <p className="hint">
                  Hosted AI requires a configured provider and a MyHours
                  account.
                </p>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={shareRecords}
                    disabled={busy}
                    onChange={(event) => {
                      setShareRecords(event.target.checked);
                      setConsent(false);
                    }}
                  />{" "}
                  Include these workspace records
                </label>
                {shareRecords ? (
                  <details>
                    <summary>Preview {availableRecords.length} records</summary>
                    <ul className="context-items">
                      {availableRecords.map((record) => (
                        <li key={record.id}>
                          {titleOf(record)} · {record.kind}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={consent}
                    disabled={busy}
                    onChange={(event) => setConsent(event.target.checked)}
                  />{" "}
                  Send this question
                  {shareRecords ? " and the selected records" : ""} to the AI
                  provider
                </label>
              </div>
            )}
            <form
              className="companion-form"
              onSubmit={(event) => {
                event.preventDefault();
                void ask(query);
              }}
            >
              <label htmlFor="companion-question">Your question</label>
              <div className="companion-input-row">
                <input
                  id="companion-question"
                  placeholder="What should I work on?"
                  value={query}
                  maxLength={3000}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setConsent(false);
                  }}
                />
                <Button
                  type="submit"
                  disabled={
                    busy || !query.trim() || (mode === "hosted" && !consent)
                  }
                >
                  <Send size={16} /> Ask
                </Button>
              </div>
            </form>
            {status ? (
              <p className="companion-error" role="alert">
                {status}
              </p>
            ) : null}
            {busy ? (
              <p className="hint" role="status">
                Waiting for the AI provider…
              </p>
            ) : null}
            {answer ? (
              <div
                className="companion-answer"
                aria-live="polite"
                aria-atomic="true"
              >
                <span className="eyebrow">
                  {answer.mode === "local" ? "LOCAL PLANNER" : "HOSTED AI"}
                </span>
                <p>{answer.text}</p>
                <div className="companion-prompts">
                  {answer.references.map((id) => {
                    const record = records.find((item) => item.id === id);
                    return record ? (
                      <Button
                        key={id}
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          close();
                          edit(record.kind, record);
                        }}
                      >
                        {titleOf(record)} <ArrowUpRight size={13} />
                      </Button>
                    ) : null;
                  })}
                </div>
              </div>
            ) : null}
            <div className="companion-actions">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  close();
                  navigate("ai");
                }}
              >
                Open AI page <ArrowUpRight size={14} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() =>
                  void savePreference({ petWalking: !p.petWalking })
                }
              >
                {p.petWalking ? <Pause size={14} /> : <Footprints size={14} />}
                {p.petWalking ? "Pause walking" : "Resume walking"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => void savePreference({ petEnabled: false })}
              >
                <EyeOff size={14} /> Hide companion
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
