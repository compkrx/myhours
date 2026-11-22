import { useEffect, useRef, useState, useId, type ReactNode } from "react";
import {
  Plus,
  X,
  Trash2,
  Check,
  Clock3,
  FileText,
  MoreHorizontal,
  ChevronUp,
  ChevronDown,
  ExternalLink,
} from "lucide-react";
import { configs, type Field } from "./config";
import { useApp } from "./context";
import {
  isOpen,
  num,
  str,
  titleOf,
  type Fields,
  type Kind,
  type LifeRecord,
} from "../domain/model";
import { displayDate, localInput, todayKey } from "../domain/time";
import { fromZonedTime } from "date-fns-tz";

export function Button({
  children,
  variant = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string }) {
  return (
    <button {...props} className={`button ${variant} ${props.className ?? ""}`}>
      {children}
    </button>
  );
}
export function IconButton({
  label,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      {...props}
      className={`icon-button ${props.className ?? ""}`}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <FileText size={24} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Modal({
  title,
  children,
  close,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={wide ? "modal wide" : "modal"}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      aria-labelledby={headingId}
    >
      <div className="modal-head">
        <h2 id={headingId}>{title}</h2>
        <IconButton label="Close dialog" onClick={close}>
          <X size={20} />
        </IconButton>
      </div>
      {children}
    </dialog>
  );
}
export function Section({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="section-head">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
export function KindTabs({
  values,
  value,
  onChange,
}: {
  values: Kind[];
  value: Kind;
  onChange: (v: Kind) => void;
}) {
  return (
    <div className="tabs" aria-label="Record categories">
      {values.map((k) => (
        <button
          key={k}
          aria-current={k === value ? "page" : undefined}
          className={k === value ? "active" : ""}
          onClick={() => onChange(k)}
        >
          {configs[k].plural}
        </button>
      ))}
    </div>
  );
}
export function RecordCard({
  record,
  compact = false,
}: {
  record: LifeRecord;
  compact?: boolean;
}) {
  const { edit, repo, p, records, notify } = useApp();
  const [busy, setBusy] = useState(false);
  const isTask = ["task", "assignment"].includes(record.kind);
  const done = ["done", "submitted", "excused"].includes(str(record, "status"));
  const due = str(record, "due");
  async function toggle() {
    setBusy(true);
    try {
      await repo.complete(record, p.timezone);
      notify(done ? "Task reopened." : "Task completed.");
    } catch (e) {
      notify(String(e));
    } finally {
      setBusy(false);
    }
  }
  const course = records.find((r) => r.id === record.data.courseId);
  const secondary = course
    ? titleOf(course)
    : str(record, "notebook") ||
      str(record, "area") ||
      str(record, "category") ||
      record.kind;
  return (
    <article
      className={`record-card ${compact ? "compact" : ""} ${done ? "done" : ""}`}
    >
      {isTask ? (
        <button
          className="task-check"
          aria-label={`${done ? "Reopen" : "Complete"} ${titleOf(record)}`}
          disabled={busy}
          onClick={toggle}
        >
          {done ? <Check size={14} /> : null}
        </button>
      ) : (
        <span className={`record-glyph ${record.kind}`}>
          <FileText size={18} />
        </span>
      )}
      <button className="record-main" onClick={() => edit(record.kind, record)}>
        <span className="record-title">{titleOf(record)}</span>
        <span className="record-meta">
          {secondary}
          {due ? ` · ${displayDate(due, p.timezone)}` : ""}
          {record.kind === "event"
            ? ` · ${displayDate(str(record, "start"), p.timezone)}`
            : ""}
          {record.provenance !== "manual" ? ` · ${record.provenance}` : ""}
        </span>
        {record.kind === "course" && record.data.reportedGrade !== undefined ? (
          <span className="record-description">
            Reported: {num(record, "reportedGrade").toFixed(2)}% ·{" "}
            {str(record, "gradeAsOf") || "date unknown"} ·{" "}
            {record.data.gradeVerified
              ? "user-verified snapshot"
              : "unverified snapshot"}
          </span>
        ) : null}
        {!compact && str(record, "nextAction") ? (
          <span className="record-description">
            Next: {str(record, "nextAction")}
          </span>
        ) : null}
        {!compact && str(record, "status") ? (
          <span className="tag">
            {str(record, "status").replaceAll("-", " ")}
          </span>
        ) : null}
      </button>
      {isTask ? (
        <span className="effort">
          <Clock3 size={13} />
          {num(record, "minutes", 30)}m
        </span>
      ) : null}
      <IconButton
        label={`Edit ${titleOf(record)}`}
        onClick={() => edit(record.kind, record)}
      >
        <MoreHorizontal size={18} />
      </IconButton>
    </article>
  );
}
export function RecordList({
  kind,
  filter,
  search = "",
  view = "list",
}: {
  kind: Kind;
  filter?: (r: LifeRecord) => boolean;
  search?: string;
  view?: string;
}) {
  const { records, edit } = useApp();
  const items = records.filter(
    (r) =>
      r.kind === kind &&
      (!filter || filter(r)) &&
      JSON.stringify(r.data).toLowerCase().includes(search.toLowerCase()),
  );
  return items.length ? (
    <div className={view === "grid" ? "record-grid" : "record-list"}>
      {items.map((r) => (
        <RecordCard key={r.id} record={r} />
      ))}
    </div>
  ) : (
    <Empty
      title={`No ${configs[kind].plural.toLowerCase()} yet`}
      description={configs[kind].empty}
      action={
        <Button variant="secondary" onClick={() => edit(kind)}>
          <Plus size={16} />
          Add {configs[kind].singular}
        </Button>
      }
    />
  );
}
function FieldInput({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: Fields[string] | undefined;
  onChange: (v: Fields[string] | undefined) => void;
}) {
  const { records, p } = useApp();
  let input: ReactNode;
  const id = `field-${field.key}`;
  const options = field.ref
    ? records.filter((r) => r.kind === field.ref)
    : field.type === "multi"
      ? records
      : [];
  if (field.type === "checkbox")
    return (
      <label className="check-label">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
        {field.label}
      </label>
    );
  if (field.type === "select" || field.type === "multi")
    input = (
      <select
        id={id}
        aria-label={field.label}
        multiple={field.type === "multi"}
        required={field.required}
        value={
          field.type === "multi"
            ? Array.isArray(value)
              ? value
              : []
            : String(value ?? "")
        }
        onChange={(e) =>
          onChange(
            field.type === "multi"
              ? Array.from(e.target.selectedOptions).map((o) => o.value)
              : e.target.value || undefined,
          )
        }
      >
        {field.type !== "multi" ? (
          <option value="">
            {field.required ? "Choose…" : "Not specified"}
          </option>
        ) : null}
        {field.ref || field.type === "multi"
          ? options.map((r) => (
              <option key={r.id} value={r.id}>
                {titleOf(r)}
              </option>
            ))
          : field.options?.map((o) => (
              <option key={o} value={o}>
                {o.replaceAll("-", " ")}
              </option>
            ))}
      </select>
    );
  else if (field.type === "textarea")
    input = (
      <textarea
        id={id}
        rows={4}
        maxLength={field.key === "body" ? 100000 : 30000}
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
        required={field.required}
      />
    );
  else
    input = (
      <input
        id={id}
        type={
          field.type === "datetime" ? "datetime-local" : (field.type ?? "text")
        }
        step={field.type === "number" ? "any" : undefined}
        value={
          field.type === "datetime" && value
            ? localInput(String(value), p.timezone)
            : String(value ?? "")
        }
        onChange={(e) =>
          onChange(
            e.target.value === ""
              ? undefined
              : field.type === "number"
                ? Number(e.target.value)
                : field.type === "datetime"
                  ? fromZonedTime(e.target.value, p.timezone).toISOString()
                  : e.target.value,
          )
        }
        required={field.required}
        maxLength={field.key === "title" ? 240 : undefined}
      />
    );
  return (
    <label
      className={field.type === "textarea" ? "form-field full" : "form-field"}
      htmlFor={id}
    >
      <span>{field.label}</span>
      {input}
      {field.hint ? <small>{field.hint}</small> : null}
    </label>
  );
}
export function Editor({
  kind,
  record,
  initial,
  close,
}: {
  kind: Kind;
  record?: LifeRecord;
  initial?: Fields;
  close: () => void;
}) {
  const { repo, p, notify, remove } = useApp();
  const conf = configs[kind];
  const [data, setData] = useState<Fields>(() => ({
    ...Object.fromEntries(
      conf.fields
        .filter((f) => f.default !== undefined)
        .map((f) => [f.key, f.default]),
    ),
    ...([
      "study",
      "practice",
      "evidence",
      "review",
      "checkin",
      "transaction",
      "focus",
    ].includes(kind)
      ? { date: todayKey(p.timezone), startDate: todayKey(p.timezone) }
      : {}),
    ...(kind === "event" ? { timezone: p.timezone } : {}),
    ...record?.data,
    ...initial,
  }));
  const [error, setError] = useState("");
  const [dueTime, setDueTime] = useState(String(data.due || "").length > 10);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const saved = await repo.save(kind, data, record);
      notify(`Saved ${configs[saved.kind].singular} on this device.`);
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal
      title={`${record ? "Edit" : "New"} ${conf.singular}`}
      close={() => {
        if (!saving) close();
      }}
      wide
    >
      <form onSubmit={save} className="editor">
        {["task", "assignment"].includes(kind) ? (
          <label className="check-label">
            <input
              type="checkbox"
              checked={dueTime}
              onChange={(e) => {
                setDueTime(e.target.checked);
                setData((d) => {
                  const next = { ...d };
                  delete next.due;
                  return next;
                });
              }}
            />
            Include an exact deadline time ({p.timezone})
          </label>
        ) : null}
        <div className="form-grid">
          <FieldInput
            field={{ key: "title", label: "Title", required: true }}
            value={data.title}
            onChange={(v) => setData((d) => ({ ...d, title: v ?? "" }))}
          />
          {conf.fields.map((f) => (
            <FieldInput
              key={f.key}
              field={
                f.key === "due" && dueTime
                  ? { ...f, type: "datetime", label: "Due date and time" }
                  : f
              }
              value={data[f.key]}
              onChange={(v) =>
                setData((d) => {
                  const n = { ...d };
                  if (v === undefined) delete n[f.key];
                  else n[f.key] = v;
                  return n;
                })
              }
            />
          ))}
        </div>
        {kind === "event" ? (
          <p className="hint">
            Times are entered in {p.timezone}. Overlapping fixed commitments are
            allowed and flagged in Calendar.
          </p>
        ) : null}
        {record ? (
          <p className="hint">
            {record.provenance} · revision {record.revision} ·{" "}
            {displayDate(record.updatedAt, p.timezone)}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="error">
            {error}
          </p>
        ) : null}
        <div className="form-actions">
          {record ? (
            <Button
              type="button"
              variant="danger ghost"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={16} />
              Delete
            </Button>
          ) : null}
          <span className="spacer" />
          <Button
            type="button"
            variant="secondary"
            onClick={close}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save " + conf.singular}
          </Button>
        </div>
        {confirmDelete ? (
          <div className="confirm-box">
            <p>
              Delete “{titleOf(record!)}”? You can undo from the notification.
            </p>
            <Button
              type="button"
              variant="danger"
              onClick={async () => {
                try {
                  await remove(record!);
                  close();
                } catch (e) {
                  setError(String(e));
                  setConfirmDelete(false);
                }
              }}
            >
              Confirm delete
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setConfirmDelete(false)}
            >
              Keep it
            </Button>
          </div>
        ) : null}
      </form>
    </Modal>
  );
}
export function PriorityControls({
  record,
  index,
  ordered,
}: {
  record: LifeRecord;
  index: number;
  ordered: LifeRecord[];
}) {
  const { repo, notify } = useApp();
  async function move(delta: number) {
    const other = ordered[index + delta];
    if (!other) return;
    try {
      await repo.db.transaction("rw", repo.db.records, async () => {
        await repo.save(
          record.kind,
          { ...record.data, priorityOrder: index + delta + 1 },
          record,
        );
        await repo.save(
          other.kind,
          { ...other.data, priorityOrder: index + 1 },
          other,
        );
      });
    } catch (e) {
      notify(String(e));
    }
  }
  return (
    <div className="priority-controls">
      <IconButton
        label={`Move ${titleOf(record)} up`}
        disabled={index === 0}
        onClick={() => move(-1)}
      >
        <ChevronUp size={14} />
      </IconButton>
      <IconButton
        label={`Move ${titleOf(record)} down`}
        disabled={index === ordered.length - 1}
        onClick={() => move(1)}
      >
        <ChevronDown size={14} />
      </IconButton>
    </div>
  );
}
export function SourceLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  try {
    const url = new URL(href);
    if (!["http:", "https:"].includes(url.protocol))
      return <span>{children}</span>;
    return (
      <a href={url.href} target="_blank" rel="noopener noreferrer">
        {children}
        <ExternalLink size={14} />
      </a>
    );
  } catch {
    return <span>{children}</span>;
  }
}
export function OpenCount({ records }: { records: LifeRecord[] }) {
  return <>{records.filter(isOpen).length}</>;
}
