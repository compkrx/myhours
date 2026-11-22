import { useState } from "react";
import { ArrowUpRight, EyeOff, Footprints, Pause, Send } from "lucide-react";
import type { ChatCompletionMessageParam } from "@mlc-ai/web-llm";
import { titleOf, type Kind } from "../domain/model";
import {
  localAI,
  localModels,
  type LocalModelId,
} from "../integrations/local-ai";
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
  const [includeWorkspace, setIncludeWorkspace] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [answer, setAnswer] = useState<{
    text: string;
    references: string[];
  }>();
  const model = p.aiModel as LocalModelId;
  const modelName =
    localModels.find((entry) => entry.id === model)?.name ?? "Gemma 3 · 1B";
  const availableRecords = records
    .filter((record) => companionScope.includes(record.kind))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 20);

  function close() {
    setOpen(false);
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
    setBusy(true);
    setAnswer({ text: "", references: [] });
    setStatus("Starting the local model…");
    const context = includeWorkspace
      ? availableRecords.map((record) => ({
          type: record.kind,
          title: titleOf(record),
          details: Object.entries(record.data)
            .filter(
              ([key, value]) =>
                key !== "title" && typeof value !== "object" && value !== "",
            )
            .slice(0, 5)
            .map(([key, value]) => `${key}: ${String(value).slice(0, 180)}`)
            .join("; "),
        }))
      : [];
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: `You are ${p.petName}, a kind and practical study companion. Answer general questions directly. Help with learning and choosing realistic next steps. Do not claim to have changed or saved anything. Be concise and honest about uncertainty.${context.length ? `\n\nThe user chose to include these local workspace records:\n${JSON.stringify(context).slice(0, 5000)}` : ""}`,
      },
      { role: "user", content: text },
    ];
    let response = "";
    try {
      for await (const chunk of localAI.reply(model, messages, (report) =>
        setStatus(report.text || "Loading model…"),
      )) {
        response += chunk;
        setAnswer({ text: response, references: [] });
        setStatus("Thinking…");
      }
      setStatus(
        response
          ? ""
          : "The model returned an empty reply. Try a shorter question.",
      );
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
            <p className="hint companion-model-note">
              {modelName} · free, on this device. First use needs WebGPU.
            </p>
            <details className="companion-context">
              <summary>
                {includeWorkspace
                  ? "Workspace context on"
                  : "Add workspace context"}
              </summary>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={includeWorkspace}
                  disabled={busy}
                  onChange={(event) =>
                    setIncludeWorkspace(event.target.checked)
                  }
                />
                Include recent tasks, assignments, events and projects
              </label>
              <p className="hint">
                This information stays in your browser and is not sent to a
                server.
              </p>
            </details>
            <div className="companion-prompts">
              {suggestedQuestions.map((question) => (
                <Button
                  key={question}
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => {
                    setQuery(question);
                    void ask(question);
                  }}
                >
                  {question}
                </Button>
              ))}
            </div>
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
                  }}
                />
                <Button type="submit" disabled={busy || !query.trim()}>
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
                {status || "Loading the local model…"}
              </p>
            ) : null}
            {answer ? (
              <div className="companion-answer" aria-live="polite">
                <span className="eyebrow">
                  `${p.petName.toUpperCase()} · ON-DEVICE AI`
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
