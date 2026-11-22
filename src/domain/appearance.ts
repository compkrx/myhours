import { prepareImage } from "./attachments";
import type { Preferences } from "./model";

export const defaultAppearance = {
  theme: "dark",
  uiStyle: "studio",
  density: "comfortable",
  accent: "",
  backgroundImage: "",
  backgroundOpacity: 0.3,
  backgroundBlur: 6,
  effectsEnabled: true,
  weatherEffect: "none",
  effectIntensity: 0.35,
  cursorTrail: "off",
  cursorImage: "",
  cursorSize: 24,
} satisfies Pick<
  Preferences,
  | "theme"
  | "uiStyle"
  | "density"
  | "accent"
  | "backgroundImage"
  | "backgroundOpacity"
  | "backgroundBlur"
  | "effectsEnabled"
  | "weatherEffect"
  | "effectIntensity"
  | "cursorTrail"
  | "cursorImage"
  | "cursorSize"
>;

export type AppearanceSettings = Pick<
  Preferences,
  keyof typeof defaultAppearance
>;

export function selectAppearance(preferences: Preferences): AppearanceSettings {
  return {
    theme: preferences.theme ?? defaultAppearance.theme,
    uiStyle: preferences.uiStyle ?? defaultAppearance.uiStyle,
    density: preferences.density ?? defaultAppearance.density,
    accent: preferences.accent ?? defaultAppearance.accent,
    backgroundImage:
      preferences.backgroundImage ?? defaultAppearance.backgroundImage,
    backgroundOpacity:
      preferences.backgroundOpacity ?? defaultAppearance.backgroundOpacity,
    backgroundBlur:
      preferences.backgroundBlur ?? defaultAppearance.backgroundBlur,
    effectsEnabled:
      preferences.effectsEnabled ?? defaultAppearance.effectsEnabled,
    weatherEffect: preferences.weatherEffect ?? defaultAppearance.weatherEffect,
    effectIntensity:
      preferences.effectIntensity ?? defaultAppearance.effectIntensity,
    cursorTrail: preferences.cursorTrail ?? defaultAppearance.cursorTrail,
    cursorImage: preferences.cursorImage ?? defaultAppearance.cursorImage,
    cursorSize: preferences.cursorSize ?? defaultAppearance.cursorSize,
  };
}

export async function readAppearanceImage(file: File) {
  const { dataURL } = await prepareImage(file);
  const image = new Image();
  image.src = dataURL;
  await image.decode();
  if (image.naturalWidth * image.naturalHeight > 24_000_000) {
    throw new Error("Choose an image under 24 megapixels.");
  }
  return dataURL;
}

type Color = [number, number, number];
const black: Color = [0, 0, 0];
const white: Color = [255, 255, 255];
const studioDark: Color = [29, 33, 36];
const studioLight: Color = [231, 234, 230];

function channels(hex: string): Color {
  return [1, 3, 5].map((index) =>
    parseInt(hex.slice(index, index + 2), 16),
  ) as Color;
}

function luminance(color: Color) {
  const rgb = color.map((value) => {
    const normalized = value / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

function contrast(a: Color, b: Color) {
  const values = [luminance(a), luminance(b)];
  return (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05);
}

function tint(color: Color, toward: Color, amount: number): Color {
  return color.map((value, index) =>
    Math.round(value + (toward[index] - value) * amount),
  ) as Color;
}

/** Keep accent links legible even when the selected swatch is very light or dark. */
export function readableAccent(hex: string, theme: "dark" | "light") {
  if (!/^#[\da-f]{6}$/i.test(hex)) return undefined;
  const dark = theme === "dark";
  const base = dark ? studioDark : studioLight;
  const toward = dark ? white : black;
  const color = channels(hex);
  let tuned = color;
  for (let step = 1; contrast(tuned, base) < 4.8 && step <= 20; step++) {
    tuned = tint(color, toward, step / 20);
  }
  return {
    color: `rgb(${tuned.join(" ")})`,
    ink: contrast(tuned, black) >= contrast(tuned, white) ? "#000" : "#fff",
  };
}
