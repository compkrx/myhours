import { useEffect, useState, type ChangeEvent, type CSSProperties } from "react";
import {
  Check,
  CloudRain,
  ImagePlus,
  Monitor,
  Moon,
  MousePointer2,
  Sun,
} from "lucide-react";
import {
  defaultAppearance,
  readAppearanceImage,
  readableAccent,
  selectAppearance,
  type AppearanceSettings,
} from "../domain/appearance";
import { Button } from "./components";
import { useApp } from "./context";
import "./appearance.css";

const styles: {
  value: AppearanceSettings["uiStyle"];
  name: string;
  detail: string;
}[] = [
  {
    value: "studio",
    name: "Studio",
    detail: "Flat surfaces and room to work.",
  },
  {
    value: "terminal",
    name: "Terminal",
    detail: "Crisp borders and a monospace interface.",
  },
  { value: "glass", name: "Glass", detail: "Layered, translucent panels." },
  {
    value: "soft",
    name: "Soft",
    detail: "Rounded edges and recessed controls.",
  },
];
const themes = [
  { value: "dark", label: "Dark", icon: Moon },
  { value: "light", label: "Light", icon: Sun },
  { value: "system", label: "System", icon: Monitor },
] as const;
const swatches = [
  { name: "Mint", color: "" },
  { name: "Blue", color: "#73a9fd" },
  { name: "Violet", color: "#ab91fb" },
  { name: "Rose", color: "#ee8b9e" },
  { name: "Amber", color: "#e8b56b" },
  { name: "Lime", color: "#bedb7b" },
];

function RangeSetting({
  label,
  min,
  max,
  step = 1,
  value,
  unit,
  onChange,
  disabled,
}: {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  unit: string;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <label className="appearance-range">
      <span>{label}</span>
      <output>
        {value}
        {unit}
      </output>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.valueAsNumber)}
      />
    </label>
  );
}

function UploadImage({
  label,
  onChange,
}: {
  label: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="appearance-file">
      <span>
        <ImagePlus size={16} aria-hidden="true" /> {label}
      </span>
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={onChange}
      />
    </label>
  );
}

function AppearancePreview({ draft }: { draft: AppearanceSettings }) {
  const theme =
    draft.theme === "system"
      ? window.matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark"
      : draft.theme;
  const accent =
    readableAccent(draft.accent, theme)?.color ??
    (theme === "light" ? "#245f4c" : "#92c9b4");
  const overlayStyle: CSSProperties = {
    opacity: draft.backgroundOpacity,
    filter: `blur(${draft.backgroundBlur}px)`,
  };
  return (
    <div className="appearance-preview-wrap">
      <div className="appearance-preview-label">
        <span>Workspace preview</span>
        <span>
          {styles.find((style) => style.value === draft.uiStyle)?.name}
        </span>
      </div>
      <div
        className={`appearance-preview preview-${theme} preview-${draft.uiStyle} preview-${draft.density}`}
        aria-hidden="true"
        style={{ "--preview-accent": accent } as CSSProperties}
      >
        {draft.backgroundImage && (
          <img
            className="appearance-preview-photo"
            src={draft.backgroundImage}
            style={overlayStyle}
            alt=""
          />
        )}
        <div className="appearance-preview-rail">
          <b />
          <i />
          <i />
          <i />
          <i />
        </div>
        <div className="appearance-preview-body">
          <span className="appearance-preview-date">Thursday, November 19</span>
          <strong>
            Today<span>.</span>
          </strong>
          <div className="appearance-preview-card">
            <span>Daily plan</span>
            <i />
            <i />
            <i />
          </div>
          {draft.effectsEnabled && draft.weatherEffect !== "none" && (
            <div className={`appearance-preview-${draft.weatherEffect}`} />
          )}
        </div>
      </div>
    </div>
  );
}

export default function Appearance() {
  const { p, setPreferences } = useApp();
  const current = selectAppearance(p);
  const [draft, setDraft] = useState(current);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [trailLoading, setTrailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [petName, setPetName] = useState(p.petName);
  useEffect(() => setPetName(p.petName), [p.petName]);
  const changed = (Object.keys(current) as (keyof AppearanceSettings)[]).some(
    (key) => current[key] !== draft[key],
  );

  function update<K extends keyof AppearanceSettings>(
    key: K,
    value: AppearanceSettings[K],
  ) {
    setDraft((previous) => ({ ...previous, [key]: value }));
    setError("");
    setMessage("");
  }

  function cancel() {
    setDraft(current);
    setError("");
    setMessage("");
  }

  async function upload(
    event: ChangeEvent<HTMLInputElement>,
    kind: "backgroundImage" | "cursorImage",
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const setLoading =
      kind === "backgroundImage" ? setPhotoLoading : setTrailLoading;
    setLoading(true);
    setError("");
    try {
      const data = await readAppearanceImage(file);
      setDraft((previous) =>
        kind === "cursorImage"
          ? { ...previous, cursorImage: data, cursorTrail: "custom" }
          : {
              ...previous,
              backgroundImage: data,
              backgroundOpacity:
                previous.backgroundOpacity ||
                defaultAppearance.backgroundOpacity,
            },
      );
      setMessage("");
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message
          ? cause.message
          : "The image could not be opened.",
      );
    } finally {
      setLoading(false);
    }
  }

  function savePetPreference(patch: Partial<Pick<typeof p, "petEnabled" | "petWalking">>) {
    void setPreferences({ ...p, ...patch }).then(
      () => setMessage("Companion settings saved."),
      (cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)),
    );
  }

  async function savePetName() {
    try {
      await setPreferences({ ...p, petName: petName.trim() });
      setError("");
      setMessage("Companion name saved.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  async function apply() {
    if (draft.cursorTrail === "custom" && !draft.cursorImage) {
      setError("Upload a custom trail image or select a built-in trail.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await setPreferences({ ...p, ...draft });
      setMessage("Appearance saved on this device.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Appearance could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="appearance-page">
      <div className="page-heading appearance-heading">
        <div>
          <h1>Appearance</h1>
          <p>Set the look and feel of your workspace.</p>
        </div>
      </div>
      <div className="appearance-layout">
        <div className="appearance-settings">
          <section
            className="appearance-section"
            aria-labelledby="workspace-look"
          >
            <h2 id="workspace-look">Workspace style</h2>
            <div className="appearance-style-grid">
              {styles.map((style) => (
                <button
                  type="button"
                  key={style.value}
                  className="appearance-style-card"
                  aria-pressed={draft.uiStyle === style.value}
                  onClick={() => update("uiStyle", style.value)}
                >
                  <div
                    className={`appearance-style-glyph style-glyph-${style.value}`}
                    aria-hidden="true"
                  >
                    <i />
                    <i />
                    <i />
                  </div>
                  <span className="appearance-style-title">
                    {style.name}
                    {draft.uiStyle === style.value && (
                      <Check size={16} aria-hidden="true" />
                    )}
                  </span>
                  <small>{style.detail}</small>
                </button>
              ))}
            </div>
            <div className="appearance-theme-density">
              <div>
                <h3>Theme</h3>
                <div className="appearance-segment" aria-label="Theme">
                  {themes.map(({ value, label, icon: Icon }) => (
                    <button
                      type="button"
                      key={value}
                      aria-pressed={draft.theme === value}
                      onClick={() => update("theme", value)}
                    >
                      <Icon size={15} aria-hidden="true" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <h3>Spacing</h3>
                <div className="appearance-segment" aria-label="Spacing">
                  <button
                    type="button"
                    aria-pressed={draft.density === "comfortable"}
                    onClick={() => update("density", "comfortable")}
                  >
                    Comfortable
                  </button>
                  <button
                    type="button"
                    aria-pressed={draft.density === "compact"}
                    onClick={() => update("density", "compact")}
                  >
                    Compact
                  </button>
                </div>
              </div>
            </div>
            <h3>Accent color</h3>
            <div className="appearance-colors" aria-label="Accent color">
              {swatches.map(({ name, color }) => (
                <button
                  key={name}
                  type="button"
                  aria-label={`${name} accent`}
                  className="appearance-swatch"
                  aria-pressed={draft.accent === color}
                  title={name}
                  style={{ "--swatch": color || "#92c9b4" } as CSSProperties}
                  onClick={() => update("accent", color)}
                >
                  {draft.accent === color && (
                    <Check size={16} aria-hidden="true" />
                  )}
                </button>
              ))}
              <label className="appearance-color-picker">
                Custom
                <input
                  aria-label="Custom accent color"
                  type="color"
                  value={draft.accent || "#92c9b4"}
                  onChange={(event) => update("accent", event.target.value)}
                />
              </label>
            </div>
          </section>
          <section
            className="appearance-section"
            aria-labelledby="workspace-wallpaper"
          >
            <h2 id="workspace-wallpaper">Wallpaper</h2>
            <p>
              Images you upload are saved on this device. PNG, JPEG, and WebP up
              to 3 MB.
            </p>
            <div className="appearance-upload-row">
              <UploadImage
                label={photoLoading ? "Reading wallpaper…" : "Upload wallpaper"}
                onChange={(event) => void upload(event, "backgroundImage")}
              />
              {draft.backgroundImage && (
                <Button
                  variant="secondary"
                  onClick={() => update("backgroundImage", "")}
                >
                  Remove wallpaper
                </Button>
              )}
            </div>
            <div className="appearance-ranges">
              <RangeSetting
                label="Opacity"
                min={0}
                max={100}
                value={Math.round(draft.backgroundOpacity * 100)}
                unit="%"
                disabled={!draft.backgroundImage}
                onChange={(value) => update("backgroundOpacity", value / 100)}
              />
              <RangeSetting
                label="Blur"
                min={0}
                max={24}
                value={draft.backgroundBlur}
                unit=" px"
                disabled={!draft.backgroundImage}
                onChange={(value) => update("backgroundBlur", value)}
              />
            </div>
          </section>
          <section
            className="appearance-section"
            aria-labelledby="workspace-motion"
          >
            <h2 id="workspace-motion">Effects</h2>
            <p>Effects pause when your device requests reduced motion.</p>
            <label className="appearance-toggle">
              <input
                type="checkbox"
                role="switch"
                checked={draft.effectsEnabled}
                onChange={(event) =>
                  update("effectsEnabled", event.target.checked)
                }
              />
              <span>Enable motion effects</span>
            </label>
            <div className="appearance-effects-grid">
              <div>
                <label className="appearance-select">
                  <span>
                    <CloudRain size={17} aria-hidden="true" /> Weather
                  </span>
                  <select
                    value={draft.weatherEffect}
                    disabled={!draft.effectsEnabled}
                    onChange={(event) =>
                      update(
                        "weatherEffect",
                        event.target
                          .value as AppearanceSettings["weatherEffect"],
                      )
                    }
                  >
                    <option value="none">Off</option>
                    <option value="rain">Rain</option>
                    <option value="snow">Snow</option>
                  </select>
                </label>
                <RangeSetting
                  label="Weather intensity"
                  min={10}
                  max={100}
                  value={Math.round(draft.effectIntensity * 100)}
                  unit="%"
                  disabled={
                    !draft.effectsEnabled || draft.weatherEffect === "none"
                  }
                  onChange={(value) => update("effectIntensity", value / 100)}
                />
              </div>
              <div>
                <label className="appearance-select">
                  <span>
                    <MousePointer2 size={17} aria-hidden="true" /> Cursor trail
                  </span>
                  <select
                    value={draft.cursorTrail}
                    disabled={!draft.effectsEnabled}
                    onChange={(event) =>
                      update(
                        "cursorTrail",
                        event.target.value as AppearanceSettings["cursorTrail"],
                      )
                    }
                  >
                    <option value="off">Off</option>
                    <option value="afterimage">Sandevistan afterimage</option>
                    <option value="dots">Colored dots</option>
                    <option value="custom">Custom image</option>
                  </select>
                </label>
                <RangeSetting
                  label="Trail size"
                  min={8}
                  max={64}
                  value={draft.cursorSize}
                  unit=" px"
                  disabled={
                    !draft.effectsEnabled || draft.cursorTrail === "off"
                  }
                  onChange={(value) => update("cursorSize", value)}
                />
              </div>
            </div>
            {draft.effectsEnabled && draft.cursorTrail === "custom" && (
              <div className="appearance-upload-row">
                {draft.cursorImage && (
                  <img
                    className="appearance-trail-sample"
                    src={draft.cursorImage}
                    alt="Custom trail image"
                  />
                )}
                <UploadImage
                  label={
                    trailLoading ? "Reading trail image…" : "Upload trail image"
                  }
                  onChange={(event) => void upload(event, "cursorImage")}
                />
                {draft.cursorImage && (
                  <Button
                    variant="secondary"
                    onClick={() =>
                      setDraft((previous) => ({
                        ...previous,
                        cursorImage: "",
                        cursorTrail: "off",
                      }))
                    }
                  >
                    Remove trail image
                  </Button>
                )}
              </div>
            )}
          </section>
          <section
            className="appearance-section"
            aria-labelledby="workspace-companion"
          >
            <h2 id="workspace-companion">Study companion</h2>
            <p>
              Optional and off by default. The companion uses the selected
              on-device model. It reads workspace records only when you turn
              on context for a question.
            </p>
            <label className="appearance-toggle">
              <input
                type="checkbox"
                role="switch"
                aria-label="Enable roaming companion"
                checked={p.petEnabled}
                onChange={(event) =>
                  savePetPreference({ petEnabled: event.target.checked })
                }
              />
              <span>Show the roaming companion</span>
            </label>
            <label className="appearance-toggle">
              <input
                type="checkbox"
                role="switch"
                aria-label="Allow companion to walk"
                checked={p.petWalking}
                disabled={!p.petEnabled}
                onChange={(event) =>
                  savePetPreference({ petWalking: event.target.checked })
                }
              />
              <span>Allow it to walk around</span>
            </label>
            <div className="settings-form companion-name-setting">
              <label htmlFor="companion-name">Companion name</label>
              <input
                id="companion-name"
                value={petName}
                maxLength={30}
                onChange={(event) => setPetName(event.target.value)}
              />
              <Button
                type="button"
                variant="secondary"
                disabled={!petName.trim() || petName.trim() === p.petName}
                onClick={() => void savePetName()}
              >
                Save companion name
              </Button>
            </div>
          </section>
        </div>
        <div className="appearance-preview-column">
          <AppearancePreview draft={draft} />
          <div className="appearance-actions">
            <Button
              onClick={() => void apply()}
              disabled={!changed || saving || photoLoading || trailLoading}
            >
              {saving ? "Saving…" : "Apply appearance"}
            </Button>
            {changed && (
              <Button
                variant="secondary"
                onClick={cancel}
                disabled={saving || photoLoading || trailLoading}
              >
                Discard changes
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={() => {
                setDraft(defaultAppearance);
                setError("");
                setMessage("");
              }}
              disabled={saving || photoLoading || trailLoading}
            >
              Reset to default
            </Button>
          </div>
          <div className="appearance-status">
            {error ? (
              <p role="alert">{error}</p>
            ) : (
              message && <p role="status">{message}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
