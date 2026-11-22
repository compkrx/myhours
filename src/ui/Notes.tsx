import { useRef, useState } from "react";
import Markdown from "react-markdown";
import { Plus, Search, BookOpen, Pin, Settings2 } from "lucide-react";
import { useApp } from "./context";
import { Button, Empty, IconButton } from "./components";
import { str, titleOf, type LifeRecord } from "../domain/model";
import { displayDate } from "../domain/time";
import KnowledgeMap from "./KnowledgeMap";
export default function Notes() {
  const { records, repo, edit, notify } = useApp();
  const [view, setView] = useState("editor");
  const [selected, setSelected] = useState("");
  const [search, setSearch] = useState("");
  const notes = records
    .filter(
      (r) =>
        r.kind === "note" &&
        `${titleOf(r)} ${str(r, "body")} ${str(r, "tags")}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort(
      (a, b) => Number(Boolean(b.data.pinned)) - Number(Boolean(a.data.pinned)),
    );
  const current = notes.find((r) => r.id === selected) ?? notes[0];
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">KNOWLEDGE / LOCAL VAULT</div>
          <h1>Notes & connections.</h1>
          <p>Markdown, linked records and your own working knowledge.</p>
        </div>
        <Button
          onClick={async () => {
            try {
              const r = await repo.save("note", {
                title: "Untitled note",
                body: "",
                notebook: "Life",
                private: true,
              });
              setSelected(r.id);
            } catch (e) {
              notify(String(e));
            }
          }}
        >
          <Plus size={18} />
          New note
        </Button>
      </div>
      <div className="tabs">
        <button
          className={view === "editor" ? "active" : ""}
          onClick={() => setView("editor")}
        >
          Notes
        </button>
        <button
          className={view === "map" ? "active" : ""}
          onClick={() => setView("map")}
        >
          Knowledge map
        </button>
      </div>
      {view === "map" ? (
        <KnowledgeMap />
      ) : (
        <div className="notes-workspace">
          <aside className="notes-list">
            <label className="search-input">
              <Search size={17} />
              <input
                aria-label="Search notes"
                placeholder="Find a thought…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            {notes.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelected(r.id)}
                className={`note-item ${current?.id === r.id ? "selected" : ""}`}
              >
                <span>
                  {str(r, "notebook")}{" "}
                  {r.data.pinned ? <Pin size={12} /> : null}
                </span>
                <strong>{titleOf(r)}</strong>
                <p>
                  {str(r, "body").slice(0, 90) || "An empty page. All yours."}
                </p>
              </button>
            ))}
          </aside>
          <div className="note-pane">
            {current ? (
              <><NoteEditor
                key={current.id}
                note={current}
                settings={() => edit("note", current)}
              /><div className="button-group"><Button variant="secondary" onClick={()=>edit('flashcard',undefined,{title:`Review ${titleOf(current)}`.slice(0,235),front:`What are the key ideas in ${titleOf(current)}?`,back:str(current,'body').slice(0,2000),deck:str(current,'notebook')||'General',notes:`From note ${current.id}`})}>Make a flashcard</Button><Button variant="ghost" onClick={()=>edit('task',undefined,{title:`Review ${titleOf(current)}`.slice(0,235),area:'Study',minutes:15,notes:`Source note: ${current.id}`})}>Plan a study block</Button></div></>
            ) : (
              <Empty
                title={search ? "No matching notes" : "A little space to think"}
                description="Create a note. Markdown stays readable, links connect ideas, and edits save on this device."
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
function NoteEditor({
  note,
  settings,
}: {
  note: LifeRecord;
  settings: () => void;
}) {
  const { repo, records, p } = useApp();
  const [data, setData] = useState(note.data);
  const [mode, setMode] = useState("write");
  const [status, setStatus] = useState("Saved on this device");
  const current = useRef(note);
  const queue = useRef(Promise.resolve());
  const relatedIds = Array.isArray(data.relatedIds) ? data.relatedIds : [];
  const related = records.filter((r) => relatedIds.includes(r.id));
  function update(key: string, value: string) {
    const next = { ...data, [key]: value };
    setData(next);
    setStatus("Saving…");
    queue.current = queue.current
      .catch(() => {})
      .then(async () => {
        try {
          const saved = await repo.save("note", next, current.current);
          current.current = saved;
          setStatus("Saved on this device");
        } catch (e) {
          setStatus(
            `Not saved: ${e instanceof Error ? e.message : String(e)}. Copy your text before leaving.`,
          );
        }
      });
  }
  return (
    <>
      <div className="note-toolbar">
        <span>
          <BookOpen size={15} />
          {str(note, "notebook")}
        </span>
        <div className="segmented">
          <button
            className={mode === "write" ? "active" : ""}
            onClick={() => setMode("write")}
          >
            Write
          </button>
          <button
            className={mode === "preview" ? "active" : ""}
            onClick={() => setMode("preview")}
          >
            Preview
          </button>
        </div>
        <IconButton
          label="Note settings and related records"
          onClick={settings}
        >
          <Settings2 size={17} />
        </IconButton>
      </div>
      <input
        className="note-title"
        aria-label="Note title"
        value={String(data.title ?? "")}
        onChange={(e) => update("title", e.target.value)}
      />
      <div className="note-save" role="status">
        {status} · {displayDate(current.current.updatedAt, p.timezone)}
      </div>
      {mode === "write" ? (
        <textarea
          className="markdown-editor"
          aria-label="Note body"
          placeholder="Start with what’s on your mind. Markdown is welcome."
          value={String(data.body ?? "")}
          onChange={(e) => update("body", e.target.value)}
          maxLength={100000}
        />
      ) : (
        <div className="markdown-preview">
          <Markdown>{String(data.body ?? "")}</Markdown>
        </div>
      )}
      {related.length ? (
        <div className="note-related">
          Related:{" "}
          {related.map((r) => (
            <span key={r.id}>{titleOf(r)} · </span>
          ))}
        </div>
      ) : null}
    </>
  );
}
