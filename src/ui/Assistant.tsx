import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ChevronDown,
  MessageSquare,
  Plus,
  Send,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import Markdown from "react-markdown";
import { useApp } from "./context";
import {
  localAI,
  localModels,
  type LocalModelId,
  type Progress,
} from "../integrations/local-ai";
import { titleOf } from "../domain/model";
import "./assistant.css";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}
interface ChatThread {
  id: string;
  title: string;
  model: LocalModelId;
  messages: ChatMessage[];
  updatedAt: number;
}

const makeId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const storageKey = (dbName: string) => `myhours:ai:threads:v1:${dbName}`;
function readThreads(key: string): ChatThread[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (value): value is ChatThread =>
          Boolean(value) &&
          typeof value.id === "string" &&
          typeof value.title === "string" &&
          Array.isArray(value.messages) &&
          value.messages.every(
            (message: unknown) =>
              Boolean(message) &&
              ["user", "assistant"].includes((message as ChatMessage).role) &&
              typeof (message as ChatMessage).text === "string",
          ),
      )
      .slice(0, 40);
  } catch {
    return [];
  }
}

const systemPrompt =
  "You are MyHours, a clear and thoughtful assistant. Answer general questions directly. For schoolwork, teach the reasoning step by step and help the student reach the answer. For planning, offer realistic next steps. Do not claim to have changed, saved, or checked anything in the app. Be honest about uncertainty and keep answers focused.";

export default function Assistant() {
  const { records, p, setPreferences, repo } = useApp();
  const key = storageKey(repo.db.name);
  const [threads, setThreads] = useState<ChatThread[]>(() => readThreads(key));
  const [activeId, setActiveId] = useState(() => {
    const saved = readThreads(key);
    return saved[0]?.id ?? makeId();
  });
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [useWorkspace, setUseWorkspace] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const active = threads.find((thread) => thread.id === activeId);
  const messages = active?.messages ?? [];
  const model = p.aiModel as LocalModelId;

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (!p.saveAiChats) return;
      const saved = threads
        .filter((thread) => thread.messages.length > 0)
        .slice(0, 40);
      try {
        localStorage.setItem(key, JSON.stringify(saved));
      } catch {
        setStatus(
          "This browser is low on storage. Older chat history may not save.",
        );
      }
    }, 450);
    return () => window.clearTimeout(timeout);
  }, [threads, key, p.saveAiChats]);

  useEffect(() => {
    const view = scrollRef.current;
    if (view) view.scrollTop = view.scrollHeight;
  }, [messages, status]);

  function updateMessages(next: (current: ChatMessage[]) => ChatMessage[]) {
    setThreads((current) => {
      const found = current.some((thread) => thread.id === activeId);
      if (!found) {
        return [
          {
            id: activeId,
            title: "New chat",
            model,
            messages: next([]),
            updatedAt: Date.now(),
          },
          ...current,
        ];
      }
      return current.map((thread) => {
        if (thread.id !== activeId) return thread;
        const updated = next(thread.messages);
        const firstUserMessage = updated.find(
          (message) => message.role === "user",
        );
        return {
          ...thread,
          model,
          messages: updated,
          title:
            thread.title === "New chat" && firstUserMessage
              ? firstUserMessage.text.slice(0, 48)
              : thread.title,
          updatedAt: Date.now(),
        };
      });
    });
  }

  function startNewChat() {
    if (busy) return;
    const id = makeId();
    setThreads((current) => [
      { id, title: "New chat", model, messages: [], updatedAt: Date.now() },
      ...current,
    ]);
    setActiveId(id);
    setStatus("");
  }

  async function submit(event?: FormEvent, suggested?: string) {
    event?.preventDefault();
    const text = (suggested ?? draft).trim();
    if (!text || busy) return;
    setDraft("");
    setBusy(true);
    setStatus("Starting the local model…");
    const prior = messages.slice(-10);
    const userMessage: ChatMessage = { role: "user", text };
    updateMessages((current) => [...current, userMessage]);
    const assistantMessage: ChatMessage = { role: "assistant", text: "" };
    updateMessages((current) => [...current, assistantMessage]);

    const contextRecords = useWorkspace
      ? records
          .filter((record) =>
            [
              "task",
              "assignment",
              "event",
              "project",
              "course",
              "note",
            ].includes(record.kind),
          )
          .slice(0, 18)
          .map((record) => ({
            type: record.kind,
            title: titleOf(record),
            details: Object.entries(record.data)
              .filter(
                ([name, value]) =>
                  name !== "title" && typeof value !== "object" && value !== "",
              )
              .slice(0, 6)
              .map(([name, value]) => `${name}: ${String(value).slice(0, 220)}`)
              .join("; "),
          }))
      : [];
    const contextMessage = contextRecords.length
      ? `\n\nThe user chose to include these local workspace records. Treat them as private context, and never claim an action was taken.\n${JSON.stringify(contextRecords).slice(0, 7000)}`
      : "";
    const prompt = [
      { role: "system" as const, content: systemPrompt + contextMessage },
      ...prior.map((message) => ({
        role: message.role,
        content: message.text,
      })),
      { role: "user" as const, content: text },
    ];
    let answer = "";
    const onProgress: Progress = (report) =>
      setStatus(report.text || "Loading model…");
    try {
      for await (const chunk of localAI.reply(model, prompt, onProgress)) {
        answer += chunk;
        const currentAnswer = answer;
        updateMessages((current) => {
          const updated = [...current];
          const last = updated.at(-1);
          if (last?.role === "assistant")
            updated[updated.length - 1] = { ...last, text: currentAnswer };
          return updated;
        });
        setStatus("Generating a reply…");
      }
      if (!answer) {
        updateMessages((current) => {
          const updated = [...current];
          if (updated.at(-1)?.role === "assistant") updated.pop();
          return updated;
        });
        setStatus("The model returned an empty reply. Try a shorter message.");
      } else {
        setStatus("");
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      updateMessages((current) => {
        const updated = [...current];
        if (updated.at(-1)?.role === "assistant") updated.pop();
        return [
          ...updated,
          { role: "assistant", text: `I couldn’t start the model. ${reason}` },
        ];
      });
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  function selectChat(id: string) {
    if (busy) return;
    setActiveId(id);
    setStatus("");
  }

  function clearHistory() {
    if (busy) return;
    setThreads([]);
    setActiveId(makeId());
    setStatus("Chat history cleared from this browser.");
  }

  const visibleThreads = threads
    .filter((thread) => thread.messages.length > 0)
    .sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="ai-shell">
      <aside className="ai-conversations" aria-label="Chat history">
        <div className="ai-history-head">
          <span>Chats</span>
        </div>
        <button className="ai-new-chat" onClick={startNewChat}>
          <Plus size={16} /> New chat
        </button>
        <div className="ai-thread-list">
          {visibleThreads.map((thread) => (
            <button
              className={`ai-thread ${thread.id === activeId ? "active" : ""}`}
              key={thread.id}
              onClick={() => selectChat(thread.id)}
              title={thread.title}
            >
              <MessageSquare size={15} />
              <span>{thread.title || "New chat"}</span>
            </button>
          ))}
          {!visibleThreads.length ? (
            <p className="ai-history-empty">Your chats will show up here.</p>
          ) : null}
        </div>
        <div className="ai-history-foot">
          <span>
            {p.saveAiChats
              ? "Chats stay in this browser"
              : "History isn’t saved"}
          </span>
          <button
            className="ai-text-button"
            onClick={clearHistory}
            disabled={!visibleThreads.length || busy}
          >
            <Trash2 size={13} /> Clear
          </button>
        </div>
      </aside>

      <section className="ai-chat" aria-label="AI chat">
        <header className="ai-toolbar">
          <div className="ai-title">
            <span>MyHours AI</span>
            <small>Free · runs on this device</small>
          </div>
          <label className="ai-model-picker">
            <span className="sr-only">Choose AI model</span>
            <select
              aria-label="Choose AI model"
              value={model}
              onChange={(event) => {
                void setPreferences({
                  ...p,
                  aiModel: event.target.value as LocalModelId,
                })
                  .then(() =>
                    setStatus(
                      "The selected model loads the next time you send a message.",
                    ),
                  )
                  .catch((error: unknown) =>
                    setStatus(
                      error instanceof Error ? error.message : String(error),
                    ),
                  );
              }}
            >
              {localModels.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
            <ChevronDown size={15} />
          </label>
          <details className="ai-options">
            <summary aria-label="AI settings" title="AI settings">
              <SlidersHorizontal size={17} />
            </summary>
            <div className="ai-options-popover">
              <strong>Chat settings</strong>
              <label className="ai-option-toggle">
                <input
                  type="checkbox"
                  checked={p.saveAiChats}
                  onChange={(event) =>
                    void setPreferences({
                      ...p,
                      saveAiChats: event.target.checked,
                    })
                  }
                />
                Save chat history on this device
              </label>
              <p>
                Model downloads are cached by your browser. Chats never leave
                this device.
              </p>
            </div>
          </details>
        </header>

        <div className="ai-scroll" ref={scrollRef} aria-live="polite">
          {!messages.length ? (
            <div className="ai-welcome">
              <h1>What can I help with?</h1>
              <p>
                Ask a question, work through a lesson, or think something
                through.
              </p>
              <div className="ai-suggestions">
                {[
                  "Explain a difficult topic simply",
                  "Help me plan a focused study session",
                  "Quiz me on something I’m learning",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => void submit(undefined, suggestion)}
                    disabled={busy}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="ai-messages">
              {messages.map((message, index) => (
                <article
                  className={`ai-message ${message.role}`}
                  key={`${activeId}-${index}`}
                >
                  {message.role === "user" ? (
                    <p>{message.text}</p>
                  ) : message.text ? (
                    <div className="markdown-preview">
                      <Markdown>{message.text}</Markdown>
                    </div>
                  ) : busy ? (
                    <span className="ai-caret" aria-label="Writing" />
                  ) : null}
                </article>
              ))}
            </div>
          )}
          {status ? (
            <p className="ai-status" role="status">
              {status}
            </p>
          ) : null}
        </div>

        <div className="ai-compose-area">
          <details className="ai-context-menu">
            <summary>
              <span>
                {useWorkspace
                  ? "Workspace context on"
                  : "Add workspace context"}
              </span>
              <ChevronDown size={14} />
            </summary>
            <div className="ai-context-popover">
              <label className="ai-option-toggle">
                <input
                  type="checkbox"
                  checked={useWorkspace}
                  onChange={(event) => setUseWorkspace(event.target.checked)}
                />
                Include my tasks, classes, notes and projects
              </label>
              <p>
                Selected records are provided only to the model running in your
                browser.
              </p>
            </div>
          </details>
          <form
            className="ai-composer"
            onSubmit={(event) => void submit(event)}
          >
            <label className="sr-only" htmlFor="ai-message">
              Message MyHours AI
            </label>
            <textarea
              id="ai-message"
              rows={1}
              maxLength={4000}
              placeholder="Message MyHours AI"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void submit();
                }
              }}
            />
            <button
              className="ai-send"
              type="submit"
              aria-label="Send message"
              disabled={busy || !draft.trim()}
            >
              <Send size={17} />
            </button>
          </form>
          <p className="ai-disclaimer">
            First use downloads{" "}
            {localModels.find((entry) => entry.id === model)?.size ??
              "the model"}
            . Requires a browser with WebGPU.
          </p>
        </div>
      </section>
    </div>
  );
}
