import { useState } from "react";
import { Database, LogIn, ShieldCheck } from "lucide-react";
import { useApp } from "./context";
import { Button, Empty, Section } from "./components";
import { cloud, cloudConfigured } from "../integrations/cloud";
import { str, titleOf } from "../domain/model";
import { displayDate } from "../domain/time";
import { pages } from "./navigation";

export function SignIn({ signedIn }: { signedIn: boolean }) {
  const { navigate } = useApp();
  const [email, setEmail] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const redirectTo = new URL(import.meta.env.BASE_URL, location.origin).href;
  async function signIn(provider: "email" | "google") {
    setBusy(true);
    setStatus("");
    try {
      const auth = cloud().auth;
      const { error } =
        provider === "google"
          ? await auth.signInWithOAuth({
              provider: "google",
              options: { redirectTo, scopes: "openid email profile" },
            })
          : await auth.signInWithOtp({
              email: email.trim(),
              options: {
                emailRedirectTo: redirectTo,
                shouldCreateUser: mode === "signup",
              },
            });
      if (error) throw error;
      if (provider === "email")
        setStatus("Check your inbox for the sign-in link.");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Sign-in failed. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>
            {signedIn
              ? "You’re signed in"
              : mode === "signup"
                ? "Create an account"
                : "Sign in to MyHours"}
          </h1>
          <p>Accounts enable cross-device sync. MyHours AI runs in your browser and does not need an account.</p>
        </div>
        <LogIn size={28} />
      </div>
      {signedIn ? (
        <Button onClick={() => navigate("account")}>Open account</Button>
      ) : (
        <div className="workspace-narrow">
          <Section title="MyHours account">
            <div className="tabs">
              <button
                className={mode === "signin" ? "active" : ""}
                onClick={() => {
                  setMode("signin");
                  setStatus("");
                }}
              >
                Sign in
              </button>
              <button
                className={mode === "signup" ? "active" : ""}
                onClick={() => {
                  setMode("signup");
                  setStatus("");
                }}
              >
                Create account
              </button>
            </div>
            {cloudConfigured ? (
              <form
                className="settings-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void signIn("email");
                }}
              >
                <label>
                  Email address
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
                <Button disabled={busy}>
                  {mode === "signup"
                    ? "Email me a registration link"
                    : "Email me a sign-in link"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void signIn("google")}
                >
                  Continue with Google
                </Button>
              </form>
            ) : (
              <p className="muted">
                Account services are unavailable until Supabase is configured
                for this build.
              </p>
            )}
            {status ? (
              <p role="status" className="sync-status">
                {status}
              </p>
            ) : null}
            <div className="button-group">
              <Button variant="ghost" onClick={() => navigate("today")}>
                Continue on this device
              </Button>
            </div>
          </Section>
        </div>
      )}
    </>
  );
}

export function MemoryPage() {
  const { records, p, setPreferences, remove, notify, navigate } = useApp();
  const activity = records
    .filter((r) =>
      ["aiSession", "importLog", "exportLog", "lessonProgress"].includes(
        r.kind,
      ),
    )
    .slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Memory</h1>
          <p>Review saved activity and choose what the assistant retains.</p>
        </div>
        <Database size={28} />
      </div>
      <div className="settings-grid">
        <Section title="AI activity memory" action={<ShieldCheck size={18} />}>
          <label className="check-label">
            <input
              type="checkbox"
              checked={p.retainAi}
              onChange={(e) => {
                void setPreferences({ ...p, retainAi: e.target.checked }).catch(
                  (error) => notify(String(error)),
                );
              }}
            />
            Keep request metadata
          </label>
          <p className="muted">
            This keeps a timestamp, the requested data categories, and
            references to your records. Prompts, answers and uploaded images are
            held in the active chat only. Each hosted request still asks for
            consent.
          </p>
          <Button variant="secondary" onClick={() => navigate("ai")}>
            Open AI assistant
          </Button>
        </Section>
        <Section title="Device storage">
          <p>{records.length} saved records in this workspace.</p>
          <p className="muted">
            Your notes, tasks and lessons persist here. Export a backup to carry
            them to another browser or restore them later.
          </p>
          <Button variant="secondary" onClick={() => navigate("privacy")}>
            Backups and sharing
          </Button>
        </Section>
      </div>
      <Section title="Recent activity">
        {activity.length ? (
          <ul className="memory-list">
            {activity.slice(0, 40).map((r) => (
              <li key={r.id}>
                <div>
                  <strong>{titleOf(r)}</strong>
                  <p>
                    {r.kind === "aiSession"
                      ? `AI request · ${Array.isArray(r.data.scope) && r.data.scope.length ? r.data.scope.join(", ") : "general question"}`
                      : str(r, "destination") ||
                        str(r, "source") ||
                        "Lesson review"}{" "}
                    · {displayDate(r.updatedAt, p.timezone)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  onClick={() =>
                    void remove(r).catch((error) => notify(String(error)))
                  }
                >
                  Remove entry
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <Empty
            title="No activity saved yet"
            description="Lesson reviews, imports, exports and optional AI request metadata appear here."
          />
        )}
      </Section>
    </>
  );
}

export function InfoPage() {
  const { navigate } = useApp();
  return (
    <>
      <div className="page-heading">
        <div>
          <img
            className="about-mark"
            src={`${import.meta.env.BASE_URL}icon.svg`}
            alt=""
          />
          <h1>MyHours</h1>
          <p>Daily routine planner</p>
        </div>
      </div>
      <div className="settings-grid">
        <Section title="Use the workspace">
          <p>
            Plan a day around real deadlines and commitments. Capture notes,
            study with lessons, and build practice from your own material.
          </p>
          <div className="button-group">
            <Button variant="secondary" onClick={() => navigate("today")}>
              Today
            </Button>
            <Button variant="secondary" onClick={() => navigate("learn")}>
              Learn
            </Button>
          </div>
        </Section>
        <Section title="Install and use offline">
          <p>
            On a supported browser, use the install action in the top bar. On
            iPhone, open the Share menu in Safari and choose Add to Home Screen.
            Open the production app online once to cache the local pages.
          </p>
          <p>Keyboard shortcuts: Ctrl or ⌘ + K for search, N for capture.</p>
          <Button variant="secondary" onClick={() => navigate("privacy")}>
            Manage my data
          </Button>
        </Section>
        <Section title="Project Life plan">
          <p>
            Long horizon and daily logs follow the graduation plan structure.
            The plan is available as a separate private import, with goals
            marked as proposals and grades marked as dated snapshots.
          </p>
          <Button variant="secondary" onClick={() => navigate("roadmap")}>
            Open long horizon
          </Button>
        </Section>
      </div>
    </>
  );
}

export function NavigationPreferences() {
  const { p, setPreferences, notify } = useApp();
  const patch = (updates: Partial<typeof p>) =>
    void setPreferences({ ...p, ...updates }).catch((error) =>
      notify(String(error)),
    );
  const options = pages.filter(
    (page) =>
      ![
        "today",
        "settings",
        "appearance",
        "account",
        "login",
        "privacy",
        "info",
      ].includes(page.id),
  );
  return (
    <Section title="Navigation">
      <p className="muted">
        Choose up to four links for the phone dock. Hide optional pages from the
        sidebar and dock. All pages stay available through search.
      </p>
      <div className="nav-preferences">
        {options.map((page) => {
          const pinned = p.pinnedRoutes.includes(page.id);
          return (
            <div key={page.id}>
              <span>{page.label}</span>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={pinned}
                  disabled={!pinned && p.pinnedRoutes.length >= 4}
                  onChange={(e) =>
                    patch({
                      pinnedRoutes: e.target.checked
                        ? [...p.pinnedRoutes, page.id]
                        : p.pinnedRoutes.filter((id) => id !== page.id),
                    })
                  }
                />
                Dock
              </label>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={!p.hiddenRoutes.includes(page.id)}
                  onChange={(e) =>
                    patch({
                      hiddenRoutes: e.target.checked
                        ? p.hiddenRoutes.filter((id) => id !== page.id)
                        : [...p.hiddenRoutes, page.id],
                    })
                  }
                />
                Show
              </label>
            </div>
          );
        })}
        <label className="check-label">
          <input
            type="checkbox"
            checked={p.musicEnabled}
            onChange={(e) => patch({ musicEnabled: e.target.checked })}
          />
          Enable music player
        </label>
      </div>
    </Section>
  );
}
