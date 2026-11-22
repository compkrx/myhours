import { useState } from "react";
import {
  Upload,
  Download,
  School,
  FileText,
  ExternalLink,
  Check,
  ShieldCheck,
} from "lucide-react";
import { useApp } from "./context";
import { Button, Section, SourceLink } from "./components";
import {
  importFields,
  parseCSV,
  previewCSV,
  suggestMapping,
  type ImportDraft,
  type ImportTarget,
} from "../domain/imports";
import { str, titleOf, type Fields } from "../domain/model";
import { download } from "../domain/snapshot";
export default function ImportCenter() {
  const { records, repo, p, edit, notify, navigate } = useApp();
  const [rows, setRows] = useState<string[][]>();
  const [target, setTarget] = useState<ImportTarget>("course");
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [source, setSource] = useState("Infinite Campus file");
  const [filename, setFilename] = useState("");
  const [drafts, setDrafts] = useState<ImportDraft[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  function preview(items: ImportDraft[]) {
    setDrafts(items);
    setSelected(items.flatMap((d, i) => (d.state === "new" ? [i] : [])));
  }
  async function read(file: File) {
    setError("");
    setBusy(true);
    setFilename(file.name);
    setRows(undefined);
    preview([]);
    try {
      if (/\.csv$/i.test(file.name)) {
        const parsed = parseCSV(await file.text());
        if (
          parsed[0].some((h) =>
            /^(givenname|familyname|password|birthdate|ssn)$/i.test(
              h.replace(/[^a-z]/gi, ""),
            ),
          )
        )
          throw new Error(
            "This looks like a people or credentials roster. Import classes/courses instead; personal identity fields are not supported.",
          );
        setRows(parsed);
        setMapping(suggestMapping(parsed[0], target));
      } else if (/\.ics$/i.test(file.name)) {
        const { importICS } = await import("../integrations/ical");
        const items = importICS(await file.text());
        preview(
          items.map((data) => {
            const found = records.find(
              (r) =>
                r.kind === "event" && r.data.externalId === data.externalId,
            );
            return {
              kind: "event",
              data: data as unknown as Fields,
              state: found ? "duplicate" : "new",
              existingId: found?.id,
              message: found
                ? "Already imported."
                : "Bounded calendar occurrence; review timezone.",
            };
          }),
        );
      } else if (/\.pdf$/i.test(file.name)) {
        const { extractPDF } = await import("../integrations/pdf");
        const body = await extractPDF(file);
        preview([
          {
            kind: "note",
            data: {
              title: file.name.replace(/\.pdf$/i, ""),
              body,
              private: true,
              notebook: "Life",
              tags: "school-import,pdf",
            },
            state: "new",
            message:
              "Text extracted locally. This saves a private note, not inferred classes or deadlines. Review the text and enter actual records separately.",
          },
        ]);
      } else if (/\.(md|txt)$/i.test(file.name)) {
        if (file.size > 100000) throw new Error("Text note limit is 100 KB.");
        preview([
          {
            kind: "note",
            data: {
              title: file.name.replace(/\.(md|txt)$/i, ""),
              body: await file.text(),
              notebook: "Life",
              private: true,
            },
            state: "new",
            message: "Private note; preview before saving.",
          },
        ]);
      } else if (/\.json$/i.test(file.name)) {
        if (file.size > 2_000_000)
          throw new Error("JSON import limit is 2 MB.");
        const data: unknown = JSON.parse(await file.text());
        if (data && typeof data === "object" && "format" in data)
          throw new Error(
            "Versioned backup or sharing snapshot detected. Use Data & privacy → Restore backup for full backups. Read-only snapshots are not backups.",
          );
        if (
          !Array.isArray(data) ||
          data.length > 2000 ||
          !data.every((v) => v && typeof v === "object" && !Array.isArray(v))
        )
          throw new Error("JSON must be an array of flat row objects.");
        const headers = [...new Set(data.flatMap((r) => Object.keys(r)))];
        const parsed = [
          headers,
          ...data.map((r) =>
            headers.map((h) => (r[h] === undefined ? "" : String(r[h]))),
          ),
        ];
        setRows(parsed);
        setMapping(suggestMapping(headers, target));
      } else
        throw new Error(
          "Choose CSV, JSON rows, ICS, PDF, Markdown or plain text. Images belong in the signed-in AI assistant.",
        );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    setBusy(true);
    setError("");
    try {
      let count = 0;
      await repo.db.transaction("rw", repo.db.records, async () => {
        const known = new Set(
          (await repo.list()).map((r) => r.data.externalId).filter(Boolean),
        );
        for (const i of selected) {
          const draft = drafts[i];
          if (
            draft.state !== "new" ||
            (draft.data.externalId && known.has(draft.data.externalId))
          )
            continue;
          await repo.save(draft.kind, draft.data, undefined, "imported");
          if (draft.data.externalId) known.add(draft.data.externalId);
          count++;
        }
        await repo.save("importLog", {
          title: `Imported ${filename}`,
          date: new Date().toISOString(),
          count,
          source,
        });
      });
      notify(`Imported ${count} reviewed record(s) on this device.`);
      preview([]);
      setRows(undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">SCHOOL / IMPORT PORT</div>
          <h1>Bring your school with you.</h1>
          <p>
            Files from your Chromebook, class exports, schedules and notes.
            Preview every import.
          </p>
        </div>
        <School size={30} />
      </div>
      <div className="settings-grid">
        <Section title="School portals" action={<School size={19} />}>
          <p className="muted">
            Save an Infinite Campus or other school portal link. Open it in its
            own tab, then bring over files your school lets you download.
          </p>
          {records
            .filter((r) => r.kind === "schoolSource")
            .map((r) => (
              <div className="portal-row" key={r.id}>
                <SourceLink href={str(r, "url")}>{titleOf(r)}</SourceLink>
                <Button variant="ghost" onClick={() => edit("schoolSource", r)}>
                  Edit
                </Button>
              </div>
            ))}
          <Button
            variant="secondary"
            onClick={() =>
              edit("schoolSource", undefined, { title: "Infinite Campus" })
            }
          >
            Add portal link
          </Button>
          <div className="notice">
            <strong>File import ready · direct sync not connected</strong>
            <p>
              Infinite Campus API access is provisioned by the school/district
              for approved integrations. A student portal login alone does not
              grant this app API access. Never paste school passwords, session
              cookies or district secrets into this app.
            </p>
            <a
              className="text-button"
              href="https://kb.infinitecampus.com/help/oneroster-prerequisites"
              target="_blank"
              rel="noopener noreferrer"
            >
              Official integration requirements <ExternalLink size={13} />
            </a>
          </div>
        </Section>
        <Section title="Choose a local file" action={<Upload size={19} />}>
          <div className="settings-form">
            <label>
              Import source
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
              >
                <option>Infinite Campus file</option>
                <option>OneRoster classes file</option>
                <option>Other school or personal file</option>
              </select>
            </label>
            <label className="button secondary">
              <Upload size={16} />
              {busy ? "Reading…" : "Choose file"}
              <input
                className="sr-only"
                type="file"
                disabled={busy}
                accept=".csv,.json,.ics,.pdf,.md,.txt"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void read(file);
                  e.target.value = "";
                }}
              />
            </label>
            <p className="hint">
              CSV/JSON rows: map columns to courses, assignments, tasks,
              assessments or events. ICS: local calendar preview. PDF: locally
              extracted private note, with no automatic grade/deadline
              inference. Markdown/text: private note.
            </p>
            <div className="button-group">
              <Button
                variant="ghost"
                onClick={() =>
                  download(
                    "classes-template.csv",
                    "title,period,reportedGrade,gradeAsOf\nExample class (replace me),1,,\n",
                    "text/csv",
                  )
                }
              >
                <Download size={14} />
                Class template
              </Button>
              <Button
                variant="ghost"
                onClick={() =>
                  download(
                    "assignments-template.csv",
                    "title,course,due,minutes,status,externalId\nExample worksheet (replace me),Example class (replace me),2030-01-15,30,open,sample-id\n",
                    "text/csv",
                  )
                }
              >
                Assignment template
              </Button>
            </div>
            <Button variant="ghost" onClick={() => navigate("privacy")}>
              Open backups and restore
            </Button>
          </div>
        </Section>
      </div>
      {rows ? (
        <Section
          title={`Map columns · ${filename}`}
          subtitle={`${rows.length - 1} row(s). Import courses first when assignments refer to their names.`}
        >
          <div className="settings-form">
            <label>
              Record type
              <select
                value={target}
                onChange={(e) => {
                  const next = e.target.value as ImportTarget;
                  setTarget(next);
                  setMapping(suggestMapping(rows[0], next));
                  preview([]);
                }}
              >
                {Object.keys(importFields).map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </label>
            <div className="mapping-grid">
              {importFields[target].map((field) => (
                <label key={field}>
                  {field}
                  <select
                    aria-label={`Map ${field}`}
                    value={mapping[field] ?? -1}
                    onChange={(e) =>
                      setMapping((m) => ({
                        ...m,
                        [field]: Number(e.target.value),
                      }))
                    }
                  >
                    <option value={-1}>Not provided</option>
                    {rows[0].map((h, i) => (
                      <option key={i} value={i}>
                        {h}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <p className="hint">
              Dates must be YYYY-MM-DD or ISO instants with an offset. Unknown
              weights, grades and dates stay blank. Existing records are never
              silently overwritten.
            </p>
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  preview(
                    await previewCSV(
                      rows,
                      target,
                      mapping,
                      records,
                      p.timezone,
                      source,
                    ),
                  );
                } catch (e) {
                  setError(String(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Build import preview
            </Button>
          </div>
        </Section>
      ) : null}
      {error ? (
        <p role="alert" className="error">
          {error}
        </p>
      ) : null}
      {drafts.length ? (
        <Section
          title={`Review ${drafts.length} proposed record(s)`}
          action={<ShieldCheck size={19} />}
        >
          <div className="import-preview-list">
            {drafts.map((draft, i) => (
              <article key={i} className={`import-draft ${draft.state}`}>
                <div>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      disabled={draft.state !== "new" || busy}
                      checked={selected.includes(i)}
                      onChange={(e) =>
                        setSelected((s) =>
                          e.target.checked
                            ? [...s, i]
                            : s.filter((x) => x !== i),
                        )
                      }
                    />
                    <strong>
                      {String(draft.data.title || "Untitled row")}
                    </strong>
                    <span className="tag">
                      {draft.kind} · {draft.state}
                    </span>
                  </label>
                  <p className="hint">{draft.message}</p>
                  <details>
                    <summary>Preview fields</summary>
                    <pre>{JSON.stringify(draft.data, null, 2)}</pre>
                  </details>
                </div>
                {draft.existingId ? (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      const record = records.find(
                        (r) => r.id === draft.existingId,
                      );
                      if (record) edit(record.kind, record);
                    }}
                  >
                    Open original
                  </Button>
                ) : null}
              </article>
            ))}
          </div>
          <div className="form-actions">
            <Button variant="secondary" onClick={() => preview([])}>
              Discard preview
            </Button>
            <Button disabled={busy || !selected.length} onClick={save}>
              <Check size={16} />
              {busy ? "Saving…" : `Confirm ${selected.length} selected imports`}
            </Button>
          </div>
        </Section>
      ) : null}
      <Section title="Recent imports">
        <div className="category-summary">
          {records
            .filter((r) => r.kind === "importLog")
            .slice(-8)
            .reverse()
            .map((r) => (
              <div key={r.id}>
                <span>{titleOf(r)}</span>
                <span>
                  {String(r.data.count)} records · {str(r, "date").slice(0, 10)}
                </span>
              </div>
            ))}
          {!records.some((r) => r.kind === "importLog") ? (
            <p className="muted">
              <FileText size={16} /> No imports recorded.
            </p>
          ) : null}
        </div>
      </Section>
    </>
  );
}
