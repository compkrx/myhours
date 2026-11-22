import { useState } from "react";
import {
  Download,
  Upload,
  ShieldCheck,
  Cloud,
  Share2,
  Trash2,
  RefreshCw,
  Copy,
  Check,
} from "lucide-react";
import { NavigationPreferences } from "./WorkspacePages";
import { useApp } from "./context";
import { Button, Modal, Section } from "./components";
import {
  defaultShareKinds,
  download,
  makeBackup,
  makeSnapshot,
  parseBackup,
  type Backup,
} from "../domain/snapshot";
import { configs } from "./config";
import {
  kinds,
  str,
  titleOf,
  type Fields,
  type Kind,
  type Preferences,
} from "../domain/model";
import {
  cloud,
  cloudConfigured,
  syncRecords,
  resolveConflict,
  type SyncConflict,
} from "../integrations/cloud";
import { displayDate } from "../domain/time";
import {
  createDriveFolder,
  googleConfigured,
  googleToken,
  listDriveFolders,
  readCalendar,
  uploadSnapshot,
  writeCalendarEvent,
} from "../integrations/google";
interface AccountState {
  uid?: string;
  email?: string;
}
export default function Settings({
  account,
  section = "settings",
}: {
  account: AccountState;
  section?: "settings" | "account" | "connections" | "privacy";
}) {
  const { p, repo, records, setPreferences, notify, navigate } = useApp();
  const [form, setForm] = useState(p);
  const [backup, setBackup] = useState<Backup>();
  const [share, setShare] = useState(false);
  const [wipe, setWipe] = useState("");
  const [cloudDelete, setCloudDelete] = useState("");
  const [status, setStatus] = useState(
    account.uid
      ? "Signed in; not yet synced this session."
      : "Local-only. No data is uploaded.",
  );
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [busy, setBusy] = useState(false);
  const [selection, setSelection] = useState<Kind[]>(defaultShareKinds);
  const [privateNotes, setPrivateNotes] = useState(false);
  const [driveToken, setDriveToken] = useState("");
  const [folders, setFolders] = useState<{ id: string; name: string }[]>([]);
  const [folderName, setFolderName] = useState("MyHours snapshots");
  const [googleImport, setGoogleImport] = useState<Fields[]>();
  const [writeId, setWriteId] = useState("");
  const [writeConfirm, setWriteConfirm] = useState(false);
  const [googleStatus, setGoogleStatus] = useState("Not connected.");
  const snapshot = makeSnapshot(records, p, selection, privateNotes);
  const change = <K extends keyof Preferences>(k: K, v: Preferences[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  async function perform(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      notify(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  async function logExport(destination: string, count: number) {
    const at = new Date().toISOString();
    await repo.setPreferences({ ...p, lastExport: at });
    await repo.save("exportLog", {
      title: "User-approved export",
      date: at,
      count,
      destination,
    });
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>
            {
              {
                settings: "Settings",
                account: "Account",
                connections: "Connections",
                privacy: "Data & privacy",
              }[section]
            }
          </h1>
          <p>
            {
              {
                settings: "Workspace preferences and navigation.",
                account: "Identity and cloud sync.",
                connections:
                  "Connect school and Google services when you need them.",
                privacy: "Manage backups, sharing and device data.",
              }[section]
            }
          </p>
        </div>
        <ShieldCheck size={28} />
      </div>
      <div className="settings-grid">
        {section === "settings" ? (
          <>
            <Section title="Preferences">
              <form
                className="settings-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void perform(async () => {
                    await setPreferences(form);
                    notify("Preferences saved.");
                  });
                }}
              >
                <label>
                  Theme
                  <select
                    value={form.theme}
                    onChange={(e) =>
                      change("theme", e.target.value as Preferences["theme"])
                    }
                  >
                    {["dark", "light", "system"].map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Timezone
                  <input
                    value={form.timezone}
                    onChange={(e) => change("timezone", e.target.value)}
                    required
                  />
                </label>
                <div className="two-columns">
                  <label>
                    Wake time
                    <input
                      type="time"
                      value={form.wake}
                      onChange={(e) => change("wake", e.target.value)}
                      required
                    />
                  </label>
                  <label>
                    Bedtime
                    <input
                      type="time"
                      value={form.bed}
                      onChange={(e) => change("bed", e.target.value)}
                      required
                    />
                  </label>
                </div>
                <label>
                  Reserve for meals, recovery, family and free time (min/day)
                  <input
                    type="number"
                    min="0"
                    max="600"
                    value={form.reservedMinutes}
                    onChange={(e) =>
                      change("reservedMinutes", Number(e.target.value))
                    }
                  />
                </label>
                <label>
                  Ledger currency (3 letters)
                  <input
                    value={form.currency}
                    minLength={3}
                    maxLength={3}
                    onChange={(e) =>
                      change("currency", e.target.value.toUpperCase())
                    }
                  />
                </label>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={form.retainAi}
                    onChange={(e) => change("retainAi", e.target.checked)}
                  />
                  Retain minimal AI activity metadata (no prompts)
                </label>
                <p className="hint">
                  Sleep opportunity:{" "}
                  {(
                    ((Number(form.wake.slice(0, 2)) * 60 +
                      Number(form.wake.slice(3)) -
                      Number(form.bed.slice(0, 2)) * 60 -
                      Number(form.bed.slice(3)) +
                      1440) %
                      1440) /
                    60
                  ).toFixed(1)}{" "}
                  h. An 8–10 hour opportunity is the default guideline. Keep
                  bedtime after wake time within the same day for this planner.
                </p>
                <Button type="submit" disabled={busy}>
                  Save preferences
                </Button>
              </form>
            </Section>
            <NavigationPreferences />
          </>
        ) : null}
        {section === "privacy" ? (
          <>
            <div>
              <Section
                title="Back up and restore"
                action={<Download size={18} />}
              >
                <p className="muted">
                  Browser storage can be cleared or evicted. A backup contains
                  all local records and preferences, including private notes.
                  Keep it somewhere private.
                </p>
                <div className="button-group">
                  <Button
                    variant="secondary"
                    onClick={() =>
                      perform(async () => {
                        const all = await repo.db.records.toArray();
                        download(
                          "myhours-backup.json",
                          JSON.stringify(makeBackup(all, p), null, 2),
                        );
                        await logExport(
                          "Private local backup download",
                          all.length,
                        );
                        notify("Full backup downloaded.");
                      })
                    }
                  >
                    <Download size={16} />
                    Full backup
                  </Button>
                  <label className="button secondary">
                    <Upload size={16} />
                    Restore backup
                    <input
                      className="sr-only"
                      type="file"
                      accept="application/json,.json"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try {
                            setBackup(parseBackup(await file.text()));
                          } catch (err) {
                            notify(String(err));
                          }
                        }
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
                <p className="hint">
                  Last export:{" "}
                  {p.lastExport
                    ? displayDate(p.lastExport, p.timezone)
                    : "Never"}
                  . Restoring replaces this workspace after confirmation.
                </p>
                <Button
                  variant="secondary"
                  onClick={() =>
                    perform(async () => {
                      const persisted = await navigator.storage?.persist?.();
                      notify(
                        persisted
                          ? "Persistent browser storage granted. Keep making backups."
                          : "Persistent storage was not granted by this browser. Keep making backups.",
                      );
                    })
                  }
                >
                  Request durable browser storage
                </Button>
              </Section>
              <Section title="Share with ChatGPT" action={<Share2 size={18} />}>
                <p className="muted">
                  Preview a read-only, redacted report. Download or copy it,
                  then attach it to a chat. ChatGPT has no automatic access to
                  this app.
                </p>
                <Button onClick={() => setShare(true)}>
                  Choose data and preview
                </Button>
              </Section>
              <Section title="Storage & accessibility">
                <p>
                  No analytics, advertising or remote fonts. Markdown HTML is
                  disabled. Motion follows your system’s reduced-motion setting.
                  Keyboard shortcut: Ctrl/Cmd+K to search, N to capture.
                </p>
                <p className="hint">
                  Local records are not encrypted by this app. Anyone with
                  access to this browser profile may read them. Use a private
                  device profile.
                </p>
                <span className="status-pill">
                  {records.length} active records · IndexedDB
                </span>
              </Section>
            </div>
          </>
        ) : null}
        {section === "account" ? (
          <Section title="Private cloud sync" action={<Cloud size={18} />}>
            <p className="muted">
              {cloudConfigured
                ? "Public backend configuration present. Authentication and successful sync are still required."
                : "Not configured. Core features work locally."}
            </p>
            <p className="hint">
              Use an age-eligible provider account and guardian assistance where
              required. Never share passwords here.
            </p>
            {account.uid ? (
              <>
                <p>Account: {account.email || account.uid}</p>
                <Button
                  disabled={busy}
                  onClick={() =>
                    perform(async () => {
                      setStatus("Syncing…");
                      try {
                        const result = await syncRecords(repo, account.uid!);
                        setConflicts(result.conflicts);
                        setStatus(
                          result.conflicts.length
                            ? `${result.conflicts.length} conflict(s) need your choice.`
                            : `Synced ${result.transferred} record(s) at ${new Date().toLocaleTimeString()}.`,
                        );
                      } catch (e) {
                        setStatus(
                          "Sync failed. Local edits remain on this device.",
                        );
                        throw e;
                      }
                    })
                  }
                >
                  <RefreshCw size={16} />
                  Sync now
                </Button>
                <div className="button-group">
                  <Button
                    variant="secondary"
                    onClick={() =>
                      perform(async () => {
                        const { error } = await cloud().auth.signOut();
                        if (error) throw error;
                        notify(
                          "Signed out. Account data remains in its separate local workspace.",
                        );
                      })
                    }
                  >
                    Sign out
                  </Button>
                </div>
                <p className="hint">
                  Sync is manual. Account records and the local-only workspace
                  are kept separate. Export a backup before switching devices.
                  Preferences are device-local.
                </p>
              </>
            ) : (
              <Button variant="secondary" onClick={() => navigate("login")}>
                Open sign-in
              </Button>
            )}
            <p role="status" className="sync-status">
              {status}
            </p>
            {conflicts.map((c) => (
              <div key={c.local.id} className="conflict-box">
                <h3>{titleOf(c.local)}</h3>
                <details>
                  <summary>Compare both versions</summary>
                  <h4>This device</h4>
                  <pre>{JSON.stringify(c.local.data, null, 2)}</pre>
                  <h4>Cloud</h4>
                  <pre>{JSON.stringify(c.remote.data, null, 2)}</pre>
                </details>
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() =>
                    perform(async () => {
                      await resolveConflict(repo, c, "local");
                      setConflicts((cs) => cs.filter((x) => x !== c));
                      notify("Kept this device’s version in the cloud.");
                    })
                  }
                >
                  Keep this device
                </Button>
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() =>
                    perform(async () => {
                      await resolveConflict(repo, c, "remote");
                      setConflicts((cs) => cs.filter((x) => x !== c));
                      notify("Used the cloud version on this device.");
                    })
                  }
                >
                  Use cloud version
                </Button>
              </div>
            ))}
          </Section>
        ) : null}
        {section === "connections" ? (
          <>
            <Section title="School imports">
              <p className="muted">
                Manage portal links and import available school files.
              </p>
              <Button variant="secondary" onClick={() => navigate("imports")}>
                Open import port
              </Button>
            </Section>
            <Section title="Optional Google connections">
              <p className="muted">
                {googleConfigured
                  ? "OAuth client configured. Connect only the service you want."
                  : "Not connected. A Google OAuth web client must be configured first."}
              </p>
              <p className="hint">
                Calendar reading and writing request separate permissions.
                Tokens remain in this page’s memory and are never stored in
                IndexedDB.
              </p>
              <Button
                variant="secondary"
                disabled={!googleConfigured || busy}
                onClick={() =>
                  perform(async () => {
                    const token = await googleToken(
                      "https://www.googleapis.com/auth/calendar.events.readonly",
                    );
                    const result = await readCalendar(token);
                    setGoogleImport(result);
                    setGoogleStatus(
                      "Calendar read authorized; import awaiting confirmation.",
                    );
                  })
                }
              >
                Read upcoming 30 days
              </Button>
              <div className="settings-form">
                <label>
                  Local event to copy to Google
                  <select
                    value={writeId}
                    onChange={(e) => setWriteId(e.target.value)}
                  >
                    <option value="">Choose an event</option>
                    {records
                      .filter(
                        (r) => r.kind === "event" && r.data.source !== "google",
                      )
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {titleOf(r)}
                        </option>
                      ))}
                  </select>
                </label>
                <Button
                  variant="secondary"
                  disabled={!googleConfigured || !writeId || busy}
                  onClick={() => setWriteConfirm(true)}
                >
                  Preview Google event creation
                </Button>
              </div>
              <p role="status" className="hint">
                {googleStatus}
              </p>
            </Section>
          </>
        ) : null}
        {section === "privacy" || section === "account" ? (
          <Section title="Data deletion" action={<Trash2 size={18} />}>
            <p>
              This deletes this workspace’s browser records. Files you exported
              and copies in external services remain there.
            </p>
            <label className="settings-form">
              Type DELETE LOCAL to confirm
              <input value={wipe} onChange={(e) => setWipe(e.target.value)} />
            </label>
            <Button
              variant="danger"
              disabled={wipe !== "DELETE LOCAL" || busy}
              onClick={() =>
                perform(async () => {
                  if (account.uid)
                    throw new Error(
                      "Sign out and open the local workspace before deleting local-only data. Use account deletion for cloud records.",
                    );
                  await repo.clear();
                  setWipe("");
                  notify("Local workspace cleared.");
                })
              }
            >
              Delete local data
            </Button>
            {account.uid ? (
              <>
                <p>
                  Account deletion removes this account’s cloud rows and
                  authentication identity. Other devices may retain offline
                  copies.
                </p>
                <label className="settings-form">
                  Type DELETE ACCOUNT to confirm
                  <input
                    value={cloudDelete}
                    onChange={(e) => setCloudDelete(e.target.value)}
                  />
                </label>
                <Button
                  variant="danger"
                  disabled={cloudDelete !== "DELETE ACCOUNT" || busy}
                  onClick={() =>
                    perform(async () => {
                      const { error } = await cloud().rpc("delete_my_account");
                      if (error) throw error;
                      await repo.clear();
                      await cloud().auth.signOut();
                      notify(
                        "Cloud account deleted. External exports remain your responsibility.",
                      );
                    })
                  }
                >
                  Delete cloud account
                </Button>
              </>
            ) : null}
          </Section>
        ) : null}
      </div>
      {backup ? (
        <Modal
          title="Confirm backup restore"
          close={() => setBackup(undefined)}
        >
          <div className="dialog-content">
            <p>
              Replace this workspace with {backup.records.length} records from{" "}
              {backup.generatedAt}? IDs, dates and provenance will be preserved.
              Current records will be replaced.
            </p>
            {account.uid ? (
              <p className="error">
                Restore is restricted to local-only mode. Sign out first to
                avoid cloud resurrection of replaced records.
              </p>
            ) : null}
            <Button
              disabled={busy || Boolean(account.uid)}
              onClick={() =>
                perform(async () => {
                  await repo.replaceAll(backup.records, backup.preferences);
                  setBackup(undefined);
                  notify("Backup restored transactionally.");
                })
              }
            >
              Confirm replace and restore
            </Button>
            <Button
              variant="secondary"
              disabled={busy || Boolean(account.uid)}
              onClick={() =>
                perform(async () => {
                  const result = await repo.mergeNew(backup.records);
                  setBackup(undefined);
                  notify(
                    `Merged ${result.added} new record(s); skipped ${result.skipped} existing or deleted record(s). Preferences were kept.`,
                  );
                })
              }
            >
              Merge new records only
            </Button>
            <p className="hint">
              Merge preserves existing records and your preferences, retains
              imported IDs, and skips duplicates and deletion markers.
            </p>
          </div>
        </Modal>
      ) : null}
      {share ? (
        <Modal
          title="Share a read-only snapshot"
          close={() => setShare(false)}
          wide
        >
          <div className="dialog-content">
            <p>
              Select only what you want to share. Private notes, money and
              personal reflections start excluded. Free text may still contain
              details you typed; read the preview.
            </p>
            <div className="share-categories">
              {kinds
                .filter((k) => !["aiSession", "exportLog"].includes(k))
                .map((k) => (
                  <label className="check-label" key={k}>
                    <input
                      type="checkbox"
                      checked={selection.includes(k)}
                      onChange={(e) =>
                        setSelection((s) =>
                          e.target.checked
                            ? [...s, k]
                            : s.filter((x) => x !== k),
                        )
                      }
                    />
                    {configs[k].plural}
                  </label>
                ))}
            </div>
            {selection.includes("note") ? (
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={privateNotes}
                  onChange={(e) => setPrivateNotes(e.target.checked)}
                />
                Explicitly include private notes (first 500 characters)
              </label>
            ) : null}
            <p className="hint">
              {snapshot.snapshot.records.length} selected records. Teacher and
              freeform notes fields are redacted. Review all other fields.
            </p>
            <pre className="snapshot-preview">{snapshot.markdown}</pre>
            <div className="button-group">
              <Button
                onClick={() =>
                  perform(async () => {
                    download(
                      "myhours-readonly.md",
                      snapshot.markdown,
                      "text/markdown",
                    );
                    await logExport(
                      "Selected Markdown download",
                      snapshot.snapshot.records.length,
                    );
                  })
                }
              >
                <Download size={16} />
                Markdown
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  perform(async () => {
                    download(
                      "myhours-readonly.json",
                      JSON.stringify(snapshot.snapshot, null, 2),
                    );
                    await logExport(
                      "Selected JSON download",
                      snapshot.snapshot.records.length,
                    );
                  })
                }
              >
                JSON snapshot
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  perform(async () => {
                    await navigator.clipboard.writeText(snapshot.markdown);
                    notify("Redacted Markdown copied.");
                  })
                }
              >
                <Copy size={16} />
                Copy
              </Button>
            </div>
            <hr />
            <h3>Optional Google Drive destination</h3>
            <p className="hint">
              Minimum drive.file permission: choose an app-created folder, or
              create one below. Existing unrelated Drive folders are not
              accessible with this scope. Upload happens only when you confirm.
            </p>
            {!driveToken ? (
              <Button
                variant="secondary"
                disabled={!googleConfigured || busy}
                onClick={() =>
                  perform(async () => {
                    const token = await googleToken(
                      "https://www.googleapis.com/auth/drive.file",
                    );
                    setDriveToken(token);
                    setFolders(await listDriveFolders(token));
                  })
                }
              >
                Connect Drive for this session
              </Button>
            ) : (
              <>
                <div className="settings-form">
                  <label>
                    Choose destination folder
                    <select
                      value={p.driveFolder}
                      onChange={(e) =>
                        void setPreferences({
                          ...p,
                          driveFolder: e.target.value,
                        })
                      }
                    >
                      <option value="">Choose a folder</option>
                      {folders.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    New folder name
                    <input
                      value={folderName}
                      onChange={(e) => setFolderName(e.target.value)}
                    />
                  </label>
                  <Button
                    variant="secondary"
                    disabled={!folderName.trim() || busy}
                    onClick={() =>
                      perform(async () => {
                        const folder = await createDriveFolder(
                          driveToken,
                          folderName,
                        );
                        setFolders((fs) => [...fs, folder]);
                        await setPreferences({ ...p, driveFolder: folder.id });
                        notify("Created and selected your Drive folder.");
                      })
                    }
                  >
                    Create folder in Drive
                  </Button>
                </div>
                <Button
                  disabled={!p.driveFolder || busy}
                  onClick={() =>
                    perform(async () => {
                      try {
                        const suffix = new Date()
                          .toISOString()
                          .replaceAll(":", "-");
                        await uploadSnapshot(
                          driveToken,
                          p.driveFolder,
                          `Project Life ${suffix}.md`,
                          snapshot.markdown,
                          "text/markdown",
                        );
                        await uploadSnapshot(
                          driveToken,
                          p.driveFolder,
                          `Project Life ${suffix}.json`,
                          JSON.stringify(snapshot.snapshot, null, 2),
                          "application/json",
                        );
                        await setPreferences({
                          ...p,
                          lastDriveSync: new Date().toISOString(),
                        });
                        notify(
                          "Both selected snapshots uploaded to your chosen Drive folder.",
                        );
                      } catch (e) {
                        setDriveToken("");
                        throw e;
                      }
                    })
                  }
                >
                  <Check size={16} />
                  Confirm upload of this preview
                </Button>
              </>
            )}
            <p className="hint">
              Last Drive upload: {p.lastDriveSync || "Never"}. ChatGPT can read
              this only after you separately connect Drive to ChatGPT and ask it
              to inspect the file.
            </p>
          </div>
        </Modal>
      ) : null}
      {googleImport ? (
        <Modal
          title="Confirm Google Calendar import"
          close={() => setGoogleImport(undefined)}
        >
          <div className="dialog-content">
            <p>
              {googleImport.length} upcoming occurrences. Existing Google event
              IDs will be skipped. Changed remote events require manual review;
              this is an import, not background synchronization.
            </p>
            <div className="scroll-preview">
              {googleImport.map((e) => (
                <p key={String(e.externalId)}>
                  {String(e.title)} · {displayDate(String(e.start), p.timezone)}
                </p>
              ))}
            </div>
            <Button
              disabled={busy}
              onClick={() =>
                perform(async () => {
                  await repo.db.transaction("rw", repo.db.records, async () => {
                    const known = new Set(
                      (await repo.list()).map((r) => r.data.externalId),
                    );
                    for (const data of googleImport)
                      if (!known.has(data.externalId)) {
                        await repo.save("event", data, undefined, "imported");
                        known.add(data.externalId);
                      }
                  });
                  setGoogleImport(undefined);
                  setGoogleStatus("Confirmed Google import saved locally.");
                })
              }
            >
              Confirm local import
            </Button>
          </div>
        </Modal>
      ) : null}
      {writeConfirm ? (
        <Modal
          title="Confirm real Google event creation"
          close={() => setWriteConfirm(false)}
        >
          <div className="dialog-content">
            {records
              .filter((r) => r.id === writeId)
              .map((r) => (
                <div key={r.id}>
                  <h3>{titleOf(r)}</h3>
                  <p>
                    {displayDate(str(r, "start"), p.timezone)} to{" "}
                    {displayDate(str(r, "end"), p.timezone)}
                  </p>
                  <p>
                    Repeats: {str(r, "recurrence")}. This will create an event
                    on your primary Google calendar. Repeating this action
                    creates another copy.
                  </p>
                  <Button
                    disabled={busy}
                    onClick={() =>
                      perform(async () => {
                        const token = await googleToken(
                          "https://www.googleapis.com/auth/calendar.events",
                        );
                        await writeCalendarEvent(token, r);
                        setWriteConfirm(false);
                        setGoogleStatus("Google confirmed event creation.");
                      })
                    }
                  >
                    Authorize write and create event
                  </Button>
                </div>
              ))}
          </div>
        </Modal>
      ) : null}
    </>
  );
}
