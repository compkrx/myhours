import { useEffect, useState } from "react";
import {
  Sparkles,
  Send,
  ShieldCheck,
  CalendarDays,
  Paperclip,
  X,
  LogIn,
  Trash2,
} from "lucide-react";
import Markdown from "react-markdown";
import { useApp } from "./context";
import { Button, Section, IconButton, Modal } from "./components";
import { localAnswer } from "../domain/assistant";
import { prepareImage, type ImageAttachment } from "../domain/attachments";
import { cloud, cloudConfigured } from "../integrations/cloud";
import { requestAI } from "../integrations/ai";
import { titleOf, type Kind } from "../domain/model";
interface Message {
  role: "you" | "assistant";
  text: string;
  mode: "local" | "hosted";
  references?: string[];
  images?: ImageAttachment[];
  suggestions?: { title: string; minutes: number; references: string[] }[];
}
export default function Assistant() {
  const { records, p, edit, navigate, notify, repo } = useApp();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [scope, setScope] = useState<Kind[]>([
    "task",
    "assignment",
    "event",
    "project",
  ]);
  const [hosted, setHosted] = useState(false);
  const [contextMode, setContextMode] = useState("records");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [usage, setUsage] = useState("No hosted requests this session.");
  const [signedIn, setSignedIn] = useState(false);
  const [image, setImage] = useState<ImageAttachment>();
  const [previewImage, setPreviewImage] = useState<ImageAttachment>();
  const [includeHistory, setIncludeHistory] = useState(false);
  useEffect(() => {
    if (!cloudConfigured) return;
    void cloud()
      .auth.getSession()
      .then(({ data }) => setSignedIn(Boolean(data.session)));
    const {
      data: { subscription },
    } = cloud().auth.onAuthStateChange((_e, s) => setSignedIn(Boolean(s)));
    return () => subscription.unsubscribe();
  }, []);
  const approved =
    contextMode === "records"
      ? records.filter((r) => scope.includes(r.kind)).slice(0, 40)
      : [];
  async function ask(text = input) {
    if (!text.trim() || busy) return;
    if (image && !hosted) {
      notify("Image analysis requires the signed-in hosted assistant.");
      return;
    }
    const images = image ? [image] : [];
    setInput("");
    setBusy(true);
    setMessages((m) => [
      ...m,
      { role: "you", text, mode: hosted ? "hosted" : "local", images },
    ]);
    try {
      if (!hosted) {
        const answer = localAnswer(text, approved, p);
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            text: answer.text,
            references: answer.references,
            mode: "local",
          },
        ]);
      } else {
        if (!consent)
          throw new Error(
            "Approve the selected context, optional chat history and image before sending.",
          );
        const history=includeHistory?messages.slice(-6).map(m=>({role:m.role==='you'?'user':'assistant',content:m.text.slice(0,2000)})):[];
        const answer=await requestAI({query:text,records:approved,scope:contextMode==='records'?scope:[],timezone:p.timezone,images,history});
        const refs = [...new Set(answer.claims.flatMap((c) => c.references))];
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            text: [answer.text, ...answer.claims.map((c) => c.text)].join(
              "\n\n",
            ),
            references: refs,
            images,
            suggestions: answer.suggestions,
            mode: "hosted",
          },
        ]);
        setUsage(
          `${answer.usage?.requests ?? "Unknown"} of ${answer.usage?.limit ?? "configured"} requests today · provider cost unknown here.`,
        );
        setImage(undefined);
        setConsent(false);
        if (p.retainAi)
          await repo.save("aiSession", {
            title: "Hosted AI request",
            scope: contextMode === "records" ? scope : [],
            references: refs.filter((id) => records.some((r) => r.id === id)),
            state: "draft",
          });
      }
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          mode: hosted ? "hosted" : "local",
          text: e instanceof Error ? e.message : String(e),
        },
      ]);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <Sparkles size={15} />
            MYHOURS AI
          </div>
          <h1>Ask, study, work things out.</h1>
          <p>
            General questions, image analysis and help with your own records.
          </p>
        </div>
        <span className="status-pill">
          {hosted
            ? signedIn
              ? "Signed in · hosted requests"
              : "Hosted AI · sign in required"
            : "Local tools · no model call"}
        </span>
      </div>
      <div className="ai-layout">
        <div className="chat-panel">
          <div className="assistant-welcome">
            <span className="large-ai-icon">
              <Sparkles size={29} />
            </span>
            <h2>What are you working on?</h2>
            <p>
              Use local record tools now. A connected model can explain
              concepts, review a screenshot, help with writing or code, and
              draft next steps.
            </p>
            <div className="prompt-grid">
              {[
                "What should I do now?",
                "What is overdue?",
                "What changed this week?",
                "Suggest my next practice challenge",
              ].map((q) => (
                <button key={q} onClick={() => void ask(q)} disabled={busy}>
                  {q}
                </button>
              ))}
            </div>
          </div>
          <div className="messages" aria-live="polite">
            {messages.map((m, i) => (
              <article key={i} className={`message ${m.role}`}>
                <span className="message-label">
                  {m.role === "you"
                    ? "YOU"
                    : m.mode === "hosted"
                      ? "MYHOURS AI"
                      : "LOCAL ASSISTANT · RULE-BASED"}
                </span>
                {m.role === "you" ? (
                  <p>{m.text}</p>
                ) : (
                  <div className="markdown-preview">
                    <Markdown>{m.text}</Markdown>
                  </div>
                )}
                {m.role === "you"
                  ? m.images?.map((img) => (
                      <button
                        className="chat-image"
                        key={img.id}
                        onClick={() => setPreviewImage(img)}
                      >
                        <img src={img.dataURL} alt={img.name} />
                        <span>{img.name}</span>
                      </button>
                    ))
                  : null}
                {m.references?.length ? (
                  <div className="citations">
                    {m.references.map((id) => {
                      const record = records.find((r) => r.id === id);
                      const img = m.images?.find((v) => v.id === id);
                      return record ? (
                        <button
                          key={id}
                          onClick={() => edit(record.kind, record)}
                        >
                          Record · {titleOf(record)}
                        </button>
                      ) : img ? (
                        <button key={id} onClick={() => setPreviewImage(img)}>
                          Image · {img.name}
                        </button>
                      ) : null;
                    })}
                  </div>
                ) : null}
                {m.suggestions?.map((s, j) => (
                  <div className="ai-action" key={j}>
                    <strong>Draft task: {s.title}</strong>
                    <p>{s.minutes} min · not saved</p>
                    <Button
                      variant="secondary"
                      onClick={() =>
                        edit("task", undefined, {
                          title: s.title,
                          minutes: s.minutes,
                        })
                      }
                    >
                      Preview task for approval
                    </Button>
                  </div>
                ))}
              </article>
            ))}
            {busy ? (
              <p className="thinking">Checking approved context…</p>
            ) : null}
          </div>
          {image ? (
            <div className="attachment-preview">
              <img src={image.dataURL} alt={image.name} />
              <span>
                {image.name}
                <small>
                  Not uploaded yet · included only with your next confirmed
                  request
                </small>
              </span>
              <IconButton
                label="Remove attached image"
                onClick={() => {
                  setImage(undefined);
                  setConsent(false);
                }}
              >
                <X size={16} />
              </IconButton>
            </div>
          ) : null}
          <form
            className="chat-input"
            onSubmit={(e) => {
              e.preventDefault();
              void ask();
            }}
          >
            <label className="sr-only" htmlFor="ai-message">
              Ask MyHours AI
            </label>
            <textarea
              id="ai-message"
              rows={2}
              maxLength={3000}
              placeholder={
                hosted
                  ? "Ask a question or describe the attached screenshot…"
                  : "Ask about your approved records…"
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <Button
              aria-label="Send question"
              type="submit"
              disabled={busy || !input.trim()}
            >
              <Send size={18} />
            </Button>
          </form>
          <div className="chat-controls">
            <label
              className={`button secondary ${!signedIn ? "disabled" : ""}`}
            >
              <Paperclip size={15} />
              Attach image
              <input
                className="sr-only"
                type="file"
                aria-label="Attach image"
                accept="image/png,image/jpeg,image/webp"
                disabled={!signedIn || busy}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    try {
                      setImage(await prepareImage(file));
                      setHosted(true);
                      setConsent(false);
                    } catch (err) {
                      notify(String(err));
                    }
                  }
                  e.target.value = "";
                }}
              />
            </label>
            {!signedIn ? (
              <Button variant="ghost" onClick={() => navigate("login")}>
                <LogIn size={15} />
                Sign in for image uploads
              </Button>
            ) : null}
            <Button
              variant="ghost"
              disabled={busy || (!messages.length && !image)}
              onClick={() => {
                setMessages([]);
                setImage(undefined);
                setConsent(false);
              }}
            >
              <Trash2 size={14} />
              Clear chat
            </Button>
          </div>
          <p className="chat-footnote">
            Images and conversation stay in memory. They are sent only after
            consent through the authenticated gateway. Leaving clears this chat.
            No model action saves records automatically.
          </p>
        </div>
        <aside aria-label="AI permissions">
          <Section
            title="Request permissions"
            action={<ShieldCheck size={18} />}
          >
            <label className="check-label">
              <input
                type="checkbox"
                checked={hosted}
                onChange={(e) => {
                  setHosted(e.target.checked);
                  setConsent(false);
                }}
              />
              Use hosted AI provider
            </label>
            <label className="settings-form">
              Context mode
              <select
                aria-label="AI context mode"
                value={contextMode}
                onChange={(e) => {
                  setContextMode(e.target.value);
                  setConsent(false);
                }}
              >
                <option value="records">Selected app records</option>
                <option value="general">
                  General question · no app records
                </option>
              </select>
            </label>
            {contextMode === "records" ? (
              <>
                <p className="muted">
                  Up to 40 approved records, reloaded from the protected backend
                  for a hosted request.
                </p>
                {(
                  [
                    "task",
                    "assignment",
                    "course",
                    "assessment",
                    "event",
                    "project",
                    "focus",
                    "practice",
                    "evidence",
                    "mistake",
                    "note",
                  ] as Kind[]
                ).map((k) => (
                  <label key={k} className="check-label">
                    <input
                      type="checkbox"
                      checked={scope.includes(k)}
                      onChange={(e) => {
                        setScope((s) =>
                          e.target.checked
                            ? [...s, k]
                            : s.filter((x) => x !== k),
                        );
                        setConsent(false);
                      }}
                    />
                    {k}
                  </label>
                ))}
                <details>
                  <summary>Preview {approved.length} approved records</summary>
                  <ul className="context-items">
                    {approved.map((r) => (
                      <li key={r.id}>
                        {titleOf(r)} · {r.kind}
                      </li>
                    ))}
                  </ul>
                </details>
              </>
            ) : (
              <p className="hint">
                No app records are included. Personal claims must still be
                grounded in information you explicitly provide.
              </p>
            )}
            {hosted ? (
              <>
                <hr />
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={includeHistory}
                    onChange={(e) => {
                      setIncludeHistory(e.target.checked);
                      setConsent(false);
                    }}
                  />
                  Include last six text messages (images are not resent)
                </label>
                <p className="hint">
                  The configured provider receives this question, selected
                  records, optional history and the current attachment. For
                  record context, sync those records first.
                </p>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                  />
                  I approve sending this request and selected context.
                </label>
                {!signedIn ? (
                  <Button
                    variant="secondary"
                    onClick={() => navigate("login")}
                  >
                    Open account sign-in
                  </Button>
                ) : null}
              </>
            ) : null}
            <p className="hint">{usage}</p>
          </Section>
          <Button variant="secondary" onClick={() => navigate("calendar")}>
            <CalendarDays size={17} />
            Draft a realistic day
          </Button>
        </aside>
      </div>
      {previewImage ? (
        <Modal
          title="Image attachment"
          close={() => setPreviewImage(undefined)}
          wide
        >
          <div className="dialog-content">
            <img
              className="full-image"
              src={previewImage.dataURL}
              alt={previewImage.name}
            />
            <p className="hint">{previewImage.name} · memory only</p>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
