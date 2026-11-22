import {
  Component,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useState,
  type ErrorInfo,
  type ReactNode,
} from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Menu,
  Plus,
  Search,
  ShieldCheck,
  X,
  PanelLeftClose,
  Download,
  WifiOff,
  User,
  Grid2X2,
} from "lucide-react";
import { localRepo, type Repository } from "./data/repository";
import {
  defaultPreferences,
  titleOf,
  type Fields,
  type Kind,
  type LifeRecord,
} from "./domain/model";
import { todayKey } from "./domain/time";
import { AppContext } from "./ui/context";
import { Button, Editor, IconButton, Modal } from "./ui/components";
import Today from "./ui/Today";
import Onboarding from "./ui/Onboarding";
import {
  cloud,
  cloudConfigured,
  accountRepository,
} from "./integrations/cloud";
import { parseCapture } from "./domain/assistant";
import Effects from "./ui/Effects";
import Companion from "./ui/Companion";
import { currentRoute, desktopCore, navigation, pages } from "./ui/navigation";
import "./ui/workspace.css";
import { registerSW } from "virtual:pwa-register";
const Modules = lazy(() => import("./ui/Modules"));
const Calendar = lazy(() => import("./ui/Calendar"));
const Notes = lazy(() => import("./ui/Notes"));
const Settings = lazy(() => import("./ui/Settings"));
const Assistant = lazy(() => import("./ui/Assistant"));
const ImportCenter = lazy(() => import("./ui/ImportCenter"));
const Roadmap = lazy(() => import("./ui/Roadmap"));
const Lessons = lazy(() => import("./ui/Lessons"));
const Textbooks = lazy(() => import("./ui/Textbooks"));
const Routines = lazy(() => import("./ui/Routines"));
const Appearance = lazy(() => import("./ui/Appearance"));
const Music = lazy(() => import("./ui/Music"));
const MathLab = lazy(() => import("./ui/MathLab"));
const SignIn = lazy(() =>
  import("./ui/WorkspacePages").then((m) => ({ default: m.SignIn })),
);
const MemoryPage = lazy(() =>
  import("./ui/WorkspacePages").then((m) => ({ default: m.MemoryPage })),
);
const InfoPage = lazy(() =>
  import("./ui/WorkspacePages").then((m) => ({ default: m.InfoPage })),
);
interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: string }
> {
  state = { error: "" };
  static getDerivedStateFromError(e: Error) {
    return { error: e.message };
  }
  componentDidCatch(_e: Error, _i: ErrorInfo) {}
  render() {
    return this.state.error ? (
      <main className="fatal">
        <h1>Workspace unavailable</h1>
        <p>{this.state.error}</p>
        <p>
          Your local database has not been intentionally cleared. Try reloading.
          If storage is blocked, use a browser profile that allows IndexedDB.
        </p>
        <Button onClick={() => location.reload()}>Reload</Button>
      </main>
    ) : (
      this.props.children
    );
  }
}
export default function App() {
  const [repo, setRepo] = useState<Repository>(localRepo);
  const [account, setAccount] = useState<{ uid?: string; email?: string }>({});
  const workspace = useLiveQuery(
    async () => ({
      name: repo.db.name,
      records: await repo.list(),
      preferences: await repo.preferences(),
    }),
    [repo],
  );
  const records =
    workspace?.name === repo.db.name ? workspace.records : undefined;
  const preferences =
    workspace?.name === repo.db.name ? workspace.preferences : undefined;
  const p = preferences ?? defaultPreferences();
  const [route, setRoute] = useState(() => currentRoute(location.hash));
  const [mobileMenu, setMobileMenu] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [editor, setEditor] = useState<{
    kind: Kind;
    record?: LifeRecord;
    initial?: Fields;
  }>();
  const [toast, setToast] = useState("");
  const [undo, setUndo] = useState<LifeRecord>();
  const [onboard, setOnboard] = useState(false);
  const [search, setSearch] = useState<string | undefined>();
  const [capture, setCapture] = useState(false);
  const [captureText, setCaptureText] = useState("");
  const [captureKind, setCaptureKind] = useState<Kind>("task");
  const [online, setOnline] = useState(navigator.onLine);
  const [install, setInstall] = useState<InstallPrompt>();
  const [update, setUpdate] = useState<() => Promise<void>>();
  const [readyOffline, setReadyOffline] = useState(false);
  const [clock, setClock] = useState(new Date());
  const notify = useCallback((message: string) => setToast(message), []);
  const edit = useCallback(
    (kind: Kind, record?: LifeRecord, initial?: Fields) =>
      setEditor({ kind, record, initial }),
    [],
  );
  const navigate = useCallback((next: string) => {
    location.hash = "/" + next;
    setRoute(next);
    setMobileMenu(false);
  }, []);
  useEffect(() => {
    const hash = () => {
      if (location.hash === "#main") return;
      setRoute(currentRoute(location.hash));
      setMobileMenu(false);
    };
    window.addEventListener("hashchange", hash);
    const tick = setInterval(() => setClock(new Date()), 60000);
    return () => {
      window.removeEventListener("hashchange", hash);
      clearInterval(tick);
    };
  }, []);
  useEffect(() => {
    const off = () => setOnline(navigator.onLine);
    const prompt = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallPrompt);
    };
    window.addEventListener("online", off);
    window.addEventListener("offline", off);
    window.addEventListener("beforeinstallprompt", prompt);
    return () => {
      window.removeEventListener("online", off);
      window.removeEventListener("offline", off);
      window.removeEventListener("beforeinstallprompt", prompt);
    };
  }, []);
  useEffect(() => {
    const updater = registerSW({
      onOfflineReady() {
        setReadyOffline(true);
      },
      onNeedRefresh() {
        setUpdate(() => () => updater(true));
      },
      onRegisterError() {
        notify(
          "Offline shell could not be registered. Keep this tab open while offline.",
        );
      },
    });
  }, [notify]);
  useEffect(() => {
    if (!cloudConfigured) return;
    const load = (session: { user: { id: string; email?: string } } | null) => {
      if (session) {
        setAccount({ uid: session.user.id, email: session.user.email });
        setRepo((current) =>
          current.db.name === `project-life-account-${session.user.id}`
            ? current
            : accountRepository(session.user.id),
        );
      } else {
        setAccount({});
        setRepo(localRepo);
      }
    };
    void cloud()
      .auth.getSession()
      .then(({ data, error }) => {
        if (error) notify(error.message);
        else load(data.session);
      });
    const {
      data: { subscription },
    } = cloud().auth.onAuthStateChange((_event, session) => load(session));
    return () => subscription.unsubscribe();
  }, [notify]);
  useEffect(() => {
    if (preferences && !preferences.onboarded) setOnboard(true);
  }, [preferences]);
  useEffect(() => {
    const theme =
      p.theme === "system"
        ? matchMedia("(prefers-color-scheme: light)").matches
          ? "light"
          : "dark"
        : p.theme;
    document.documentElement.dataset.theme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#101214" : "#f2f1ec");
  }, [p.theme]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (document.querySelector("dialog[open]")) return;
      const typing = (e.target as HTMLElement)?.closest(
        "input,textarea,select,[contenteditable]",
      );
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearch("");
      } else if (
        !typing &&
        !e.ctrlKey &&
        !e.metaKey &&
        e.key.toLowerCase() === "n" &&
        !editor
      ) {
        e.preventDefault();
        setCapture(true);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [editor]);
  async function remove(record: LifeRecord) {
    await repo.remove(record);
    setUndo(record);
    notify(`Deleted ${titleOf(record)}.`);
  }
  if (!records || !preferences)
    return (
      <div className="loading-screen">
        <img
          className="myhours-mark"
          src={`${import.meta.env.BASE_URL}icon.svg`}
          alt=""
        />
        <p>Opening your workspace…</p>
      </div>
    );
  const currentNav = pages.find((n) => n.id === route);
  const available = (id: string) =>
    !p.hiddenRoutes.includes(id) &&
    (id !== "music" || p.musicEnabled) &&
    (id !== "login" || !account.uid);
  const dock = [...new Set(["today", ...p.pinnedRoutes])]
    .filter(available)
    .slice(0, 4)
    .flatMap((id) => pages.filter((page) => page.id === id));
  const isWorkspaceSettings = [
    "settings",
    "privacy",
    "account",
    "connections",
  ].includes(route);
  const count = records.filter(
    (r) =>
      r.kind === "task" &&
      !["done", "submitted", "excused"].includes(String(r.data.status)),
  ).length;
  const parsed = parseCapture(captureText, p);
  const allModules = [
    "tasks",
    "school",
    "projects",
    "learning",
    "life",
    "money",
    "explore",
    "review",
  ];
  return (
    <AppContext.Provider
      value={{
        repo,
        records,
        p,
        edit,
        remove,
        notify,
        navigate,
        setPreferences: async (next) => {
          await repo.setPreferences(next);
        },
      }}
    >
      <Effects />
      <a
        className="skip-link"
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main")?.focus();
        }}
      >
        Skip to content
      </a>
      <div className={`app-shell ${collapsed ? "collapsed" : ""}`}>
        <aside
          aria-label="Workspace navigation"
          className={`sidebar ${mobileMenu ? "mobile-open" : ""}`}
        >
          <div className="brand">
            <button title="MyHours home" onClick={() => navigate("today")}>
              <img
                className="myhours-mark"
                src={`${import.meta.env.BASE_URL}icon.svg`}
                alt=""
              />
              <span className="brand-type">
                <strong>MyHours</strong>
                <small>Daily routine planner</small>
              </span>
            </button>
            <IconButton
              label="Close navigation"
              className="mobile-only"
              onClick={() => setMobileMenu(false)}
            >
              <X size={20} />
            </IconButton>
          </div>
          <button className="sidebar-search" onClick={() => setSearch("")}>
            <Search size={16} />
            <span>Find anything</span>
            <kbd>⌘ K</kbd>
          </button>
          <nav aria-label="Main navigation" className="desktop-navigation">
            {navigation.map((group) => (
              <section
                key={group.label}
                className="navigation-group"
                aria-label={group.label}
              >
                <h2>{group.label}</h2>
                {group.entries
                  .filter(
                    (item) =>
                      available(item.id) &&
                      (desktopCore.includes(item.id) ||
                        item.id === route ||
                        ["school", "music", "settings", "appearance"].includes(
                          item.id,
                        )),
                  )
                  .map((item) => (
                    <a
                      key={item.id}
                      href={`#/${item.id}`}
                      title={item.label}
                      className={route === item.id ? "active" : ""}
                      aria-current={route === item.id ? "page" : undefined}
                      onClick={() => setMobileMenu(false)}
                    >
                      <item.icon size={17} />
                      <span>{item.label}</span>
                      {item.id === "tasks" && count > 0 ? <b>{count}</b> : null}
                    </a>
                  ))}
              </section>
            ))}
            <button
              className="all-pages-button"
              onClick={() => setMobileMenu(true)}
            >
              <Grid2X2 size={17} />
              <span>All pages</span>
            </button>
          </nav>
          <div className="sidebar-bottom">
            <div className="workspace-status">
              <ShieldCheck size={16} />
              <div>
                <strong>
                  {account.uid
                    ? "Private account workspace"
                    : "Local workspace"}
                </strong>
                <span>
                  {account.uid
                    ? "Manual sync available"
                    : "Stored on this device"}
                </span>
              </div>
            </div>
            <div className="sidebar-foot">
              <span>MyHours</span>
              <IconButton
                label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                onClick={() => setCollapsed((v) => !v)}
              >
                <PanelLeftClose size={16} />
              </IconButton>
            </div>
          </div>
        </aside>
        <div className="app-body">
          <header className="topbar">
            <div className="topbar-location">
              <IconButton
                label="Open navigation"
                className="mobile-only"
                onClick={() => setMobileMenu(true)}
              >
                <Menu size={20} />
              </IconButton>
              <span>MyHours /</span>
              <strong>{currentNav?.label ?? "Settings"}</strong>
            </div>
            <div className="topbar-right">
              <span className="top-clock">
                {new Intl.DateTimeFormat(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                  timeZone: p.timezone,
                }).format(clock)}
                <span>{p.timezone.split("/").pop()?.replaceAll("_", " ")}</span>
              </span>
              <span className="connection-state">
                {online ? <ShieldCheck size={13} /> : <WifiOff size={13} />}
                <span>
                  {online ? "Local storage" : "Offline · local saves"}
                </span>
              </span>
              {install ? (
                <IconButton
                  label="Install MyHours"
                  onClick={async () => {
                    await install.prompt();
                    await install.userChoice;
                    setInstall(undefined);
                  }}
                >
                  <Download size={18} />
                </IconButton>
              ) : null}
              <IconButton
                label={account.uid ? "Open account" : "Sign in"}
                onClick={() => navigate(account.uid ? "account" : "login")}
              >
                <User size={19} />
              </IconButton>
              <IconButton label="Global search" onClick={() => setSearch("")}>
                <Search size={19} />
              </IconButton>
              <button
                className="top-capture"
                aria-label="Quick capture"
                onClick={() => setCapture(true)}
              >
                <Plus size={20} />
              </button>
            </div>
          </header>
          {update ? (
            <div className="update-banner">
              <span>
                A new version is ready. Finish editing and export a backup
                before reloading.
              </span>
              <Button variant="secondary" onClick={() => void update()}>
                Reload app
              </Button>
            </div>
          ) : null}
          <main
            id="main"
            className={`main-content route-${route}`}
            tabIndex={-1}
          >
            <Suspense fallback={<p role="status">Opening view…</p>}>
              {route === "today" ? (
                <Today />
              ) : allModules.includes(route) ? (
                <Modules key={route} route={route} />
              ) : route === "imports" ? (
                <ImportCenter />
              ) : route === "calendar" ? (
                <Calendar />
              ) : route === "notes" ? (
                <Notes />
              ) : isWorkspaceSettings ? (
                <Settings
                  key={`${repo.db.name}:${route}`}
                  section={
                    route as "settings" | "privacy" | "account" | "connections"
                  }
                  account={account}
                />
              ) : route === "appearance" ? (
                <Appearance />
              ) : route === "login" ? (
                <SignIn signedIn={Boolean(account.uid)} />
              ) : route === "memory" ? (
                <MemoryPage />
              ) : route === "info" ? (
                <InfoPage />
              ) : route === "learn" ? (
                <Lessons />
              ) : route === "textbooks" ? (
                <Textbooks />
              ) : route === "routines" ? (
                <Routines />
              ) : route === "math" ? (
                <MathLab />
              ) : route === "music" ? (
                p.musicEnabled ? null : (
                  <div className="page-heading">
                    <div>
                      <h1>Music</h1>
                      <p>Enable the player in Settings.</p>
                    </div>
                    <Button onClick={() => navigate("settings")}>
                      Open settings
                    </Button>
                  </div>
                )
              ) : route === "ai" ? (
                <Assistant key={repo.db.name} />
              ) : route === "roadmap" ? (
                <Roadmap />
              ) : (
                <Today />
              )}
            </Suspense>
            {p.musicEnabled ? (
              <Suspense
                fallback={
                  route === "music" ? <p role="status">Opening music…</p> : null
                }
              >
                <Music active={route === "music"} key={repo.db.name} />
              </Suspense>
            ) : null}
          </main>
          <footer className="app-footer">
            <span>MyHours</span>
            <span>
              {readyOffline
                ? "Offline shell ready"
                : "Local data · back up regularly"}
            </span>
            <span>{todayKey(p.timezone)}</span>
          </footer>
        </div>
        <nav className="bottom-nav" aria-label="Mobile navigation">
          {dock.map((item) => (
            <a
              key={item.id}
              href={`#/${item.id}`}
              aria-current={route === item.id ? "page" : undefined}
              className={route === item.id ? "active" : ""}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </a>
          ))}
          <button onClick={() => setMobileMenu(true)} aria-haspopup="dialog">
            <Menu size={20} />
            <span>More</span>
          </button>
        </nav>
        <button
          className="capture-fab"
          aria-label="New quick capture"
          onClick={() => setCapture(true)}
        >
          <Plus size={24} />
        </button>
      </div>
      <Companion
        paused={Boolean(
          onboard || editor || search !== undefined || capture || mobileMenu,
        )}
      />
      {mobileMenu ? (
        <Modal title="Browse pages" close={() => setMobileMenu(false)} wide>
          <div className="dialog-content page-directory">
            {navigation.map((group) => (
              <section key={group.label}>
                <h3>{group.label}</h3>
                <div>
                  {group.entries
                    .filter((item) => available(item.id))
                    .map((item) => (
                      <a
                        key={item.id}
                        href={`#/${item.id}`}
                        aria-current={route === item.id ? "page" : undefined}
                        onClick={() => setMobileMenu(false)}
                      >
                        <item.icon size={18} />
                        {item.label}
                      </a>
                    ))}
                </div>
              </section>
            ))}
          </div>
        </Modal>
      ) : null}
      {editor ? (
        <Editor
          key={editor.record?.id ?? `new-${editor.kind}`}
          {...editor}
          close={() => setEditor(undefined)}
        />
      ) : null}
      {onboard ? <Onboarding close={() => setOnboard(false)} /> : null}
      {search !== undefined ? (
        <Modal title="Find anything" close={() => setSearch(undefined)}>
          <div className="dialog-content">
            <input
              autoFocus
              type="search"
              aria-label="Global search query"
              placeholder="Search pages, tasks, notes and courses…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="search-results">
              {pages
                .filter((page) =>
                  search.trim()
                    ? page.label.toLowerCase().includes(search.toLowerCase())
                    : desktopCore.includes(page.id),
                )
                .slice(0, 12)
                .map((page) => (
                  <button
                    key={page.id}
                    onClick={() => {
                      setSearch(undefined);
                      navigate(page.id);
                    }}
                  >
                    <span>Page</span>
                    <strong>{page.label}</strong>
                  </button>
                ))}

              {search.trim() ? (
                records
                  .filter((r) =>
                    JSON.stringify(r.data)
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                  )
                  .slice(0, 30)
                  .map((r) => (
                    <button
                      key={r.id}
                      onClick={() => {
                        setSearch(undefined);
                        edit(r.kind, r);
                      }}
                    >
                      <span>{r.kind}</span>
                      <strong>{titleOf(r)}</strong>
                    </button>
                  ))
              ) : (
                <p className="muted">
                  Search your own records. Nothing leaves this device.
                </p>
              )}
            </div>
          </div>
        </Modal>
      ) : null}
      {capture ? (
        <Modal title="Quick capture" close={() => setCapture(false)}>
          <form
            className="dialog-content settings-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!captureText.trim()) return;
              setCapture(false);
              setCaptureText("");
              edit(
                captureKind,
                undefined,
                captureKind === "task"
                  ? {
                      title: parsed.title,
                      ...(parsed.due ? { due: parsed.due } : {}),
                    }
                  : captureKind === "note"
                    ? { title: captureText, body: "", private: true }
                    : {
                        title: captureText,
                        timezone: p.timezone,
                        start: new Date().toISOString(),
                      },
              );
            }}
          >
            <label>
              Capture as
              <select
                value={captureKind}
                onChange={(e) => setCaptureKind(e.target.value as Kind)}
              >
                <option value="task">Task</option>
                <option value="note">Note</option>
                <option value="event">Event</option>
              </select>
            </label>
            <label>
              What’s on your mind?
              <input
                autoFocus
                value={captureText}
                onChange={(e) => setCaptureText(e.target.value)}
                placeholder="Algebra worksheet due tomorrow"
                required
              />
            </label>
            {captureKind === "task" ? (
              <div className="capture-preview">
                <strong>Draft: {parsed.title || "Your task title"}</strong>
                <p>
                  Due: {parsed.due ?? "Not set"} · {p.timezone}
                </p>
                {parsed.ambiguous ? (
                  <p className="error">
                    The date needs clarification. Choose an exact date in the
                    next step.
                  </p>
                ) : null}
              </div>
            ) : null}
            <Button type="submit">Review before saving</Button>
          </form>
        </Modal>
      ) : null}
      {toast ? (
        <div className="toast" role="status">
          <span>{toast}</span>
          {undo ? (
            <Button
              variant="ghost"
              onClick={async () => {
                try {
                  await repo.undo(undo);
                  setUndo(undefined);
                  setToast("Restored.");
                } catch (e) {
                  notify(String(e));
                }
              }}
            >
              Undo delete
            </Button>
          ) : null}
          <IconButton
            label="Dismiss notification"
            onClick={() => {
              setToast("");
              setUndo(undefined);
            }}
          >
            <X size={17} />
          </IconButton>
        </div>
      ) : null}
    </AppContext.Provider>
  );
}
