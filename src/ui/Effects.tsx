import {
  useEffect,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} from "react";
import { readableAccent, selectAppearance } from "../domain/appearance";
import { useApp } from "./context";
import "./appearance.css";

const motionQuery = "(prefers-reduced-motion: reduce)";
function observeMotion(notify: () => void) {
  const query = window.matchMedia(motionQuery);
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
}
function reducedMotion() {
  return window.matchMedia(motionQuery).matches;
}

function fitCanvas(canvas: HTMLCanvasElement) {
  const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
  const { width, height } = canvas.getBoundingClientRect();
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const context = canvas.getContext("2d");
  context?.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { width, height, context };
}

type Particle = {
  x: number;
  y: number;
  speed: number;
  length: number;
  phase: number;
};

function Weather({
  mode,
  intensity,
}: {
  mode: "rain" | "snow";
  intensity: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let viewport = fitCanvas(canvas);
    let last = 0;
    let frame = 0;
    const snow = mode === "snow";
    const makeParticle = () => ({
      x: Math.random() * viewport.width,
      y: Math.random() * viewport.height,
      speed: snow ? 14 + Math.random() * 30 : 300 + Math.random() * 400,
      length: snow ? 0.8 + Math.random() * 1.65 : 8 + Math.random() * 14,
      phase: Math.random() * Math.PI * 2,
    });
    let particles: Particle[] = [];

    function resize() {
      viewport = fitCanvas(canvas!);
      const area = viewport.width * viewport.height;
      const count = Math.round(
        Math.min(130, Math.max(18, area / 8_000)) * intensity,
      );
      particles = Array.from({ length: count }, makeParticle);
    }

    function draw(time: number) {
      frame = 0;
      if (document.hidden || !viewport.context) return;
      // Thirty frames per second is sufficient for background ambience.
      if (!last || time - last >= 30) {
        const { context, width, height } = viewport;
        const delta = Math.min((time - (last || time - 30)) / 1_000, 0.07);
        context.clearRect(0, 0, width, height);
        context.beginPath();
        context.fillStyle = "rgba(176, 198, 221, .72)";
        context.strokeStyle = "rgba(153, 184, 214, .58)";
        context.lineWidth = 1;

        for (const particle of particles) {
          particle.y += particle.speed * delta;
          particle.x += snow
            ? Math.sin(time / 1_300 + particle.phase) * 12 * delta
            : (-particle.speed * delta) / 7;
          if (particle.y > height + 20) {
            particle.y = -20;
            particle.x = Math.random() * width;
          }
          if (particle.x < -20) particle.x = width + 20;
          if (particle.x > width + 20) particle.x = -20;

          if (snow) {
            context.moveTo(particle.x + particle.length, particle.y);
            context.arc(
              particle.x,
              particle.y,
              particle.length,
              0,
              Math.PI * 2,
            );
          } else {
            context.moveTo(particle.x, particle.y);
            context.lineTo(
              particle.x - particle.length / 7,
              particle.y + particle.length,
            );
          }
        }
        if (snow) context.fill();
        else context.stroke();
        last = time;
      }
      frame = window.requestAnimationFrame(draw);
    }

    function visibility() {
      if (document.hidden) {
        window.cancelAnimationFrame(frame);
        frame = 0;
      } else if (!frame) {
        last = 0;
        frame = window.requestAnimationFrame(draw);
      }
    }

    resize();
    visibility();
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [mode, intensity]);

  return <canvas ref={ref} className="myhours-weather" aria-hidden="true" />;
}

type Afterimage = { x: number; y: number; time: number };
const fadeAfter = 395;

function drawAfterimage(
  context: CanvasRenderingContext2D,
  size: number,
  color: string,
) {
  context.beginPath();
  context.moveTo(0, 0);
  context.lineTo(size * 0.63, size * 0.42);
  context.lineTo(size * 0.35, size * 0.48);
  context.lineTo(size * 0.48, size * 0.83);
  context.lineTo(size * 0.34, size * 0.9);
  context.lineTo(size * 0.2, size * 0.55);
  context.lineTo(size * 0.03, size * 0.73);
  context.closePath();
  context.strokeStyle = color;
  context.lineWidth = 1.35;
  context.stroke();
}

function CursorTrail({
  mode,
  image,
  size,
}: {
  mode: "afterimage" | "dots" | "custom";
  image: string;
  size: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let viewport = fitCanvas(canvas);
    const points: Afterimage[] = [];
    let frame = 0;
    let last: Afterimage | undefined;
    const sprite = mode === "custom" && image ? new Image() : undefined;
    if (sprite) sprite.src = image;

    function resize() {
      viewport = fitCanvas(canvas!);
      points.length = 0;
      last = undefined;
    }

    function draw(time: number) {
      frame = 0;
      const { context, width, height } = viewport;
      if (!context) return;
      context.clearRect(0, 0, width, height);
      while (points.length && time - points[0].time > fadeAfter) points.shift();
      for (const [index, point] of points.entries()) {
        const life = Math.max(0, 1 - (time - point.time) / fadeAfter);
        context.save();
        context.globalAlpha = life * 0.75;
        context.translate(point.x, point.y);

        if (mode === "dots") {
          context.beginPath();
          context.arc(0, 0, (size / 6) * life + 1, 0, Math.PI * 2);
          context.fillStyle = index % 2 ? "#70e7dc" : "#a898ff";
          context.fill();
        } else if (sprite?.complete && sprite.naturalWidth) {
          const scale =
            size / Math.max(sprite.naturalWidth, sprite.naturalHeight);
          const imageWidth = sprite.naturalWidth * scale;
          const imageHeight = sprite.naturalHeight * scale;
          context.drawImage(
            sprite,
            -imageWidth / 2,
            -imageHeight / 2,
            imageWidth,
            imageHeight,
          );
        } else if (mode === "afterimage") {
          drawAfterimage(context, size, index % 2 ? "#75f4df" : "#aa95ff");
        }
        context.restore();
      }
      if (points.length && !document.hidden)
        frame = window.requestAnimationFrame(draw);
    }

    function track(event: PointerEvent) {
      if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
      const time = performance.now();
      const point = { x: event.clientX, y: event.clientY, time };
      if (!last || time - last.time > fadeAfter) {
        last = point;
        return;
      }
      if (Math.hypot(point.x - last.x, point.y - last.y) < 7) return;
      points.push({ ...last, time });
      if (points.length > 18) points.shift();
      last = point;
      if (!frame) frame = window.requestAnimationFrame(draw);
    }

    function clear() {
      if (!document.hidden) return;
      window.cancelAnimationFrame(frame);
      frame = 0;
      points.length = 0;
      last = undefined;
      viewport.context?.clearRect(0, 0, viewport.width, viewport.height);
    }

    window.addEventListener("pointermove", track, { passive: true });
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", clear);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", track);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", clear);
    };
  }, [mode, image, size]);

  return (
    <canvas ref={ref} className="myhours-cursor-trail" aria-hidden="true" />
  );
}

export default function Effects() {
  const { p } = useApp();
  const appearance = selectAppearance(p);
  const prefersReduced = useSyncExternalStore(
    observeMotion,
    reducedMotion,
    () => true,
  );
  const motion = appearance.effectsEnabled && !prefersReduced;
  const hasBackground = Boolean(
    appearance.backgroundImage && appearance.backgroundOpacity > 0,
  );

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.uiStyle = appearance.uiStyle;
    root.dataset.density = appearance.density;
    root.dataset.workspaceBackground = String(hasBackground);
    const dark = readableAccent(appearance.accent, "dark");
    const light = readableAccent(appearance.accent, "light");
    const properties = {
      "--myhours-accent-dark": dark?.color,
      "--myhours-ink-dark": dark?.ink,
      "--myhours-accent-light": light?.color,
      "--myhours-ink-light": light?.ink,
    };
    for (const [key, value] of Object.entries(properties)) {
      if (value) root.style.setProperty(key, value);
      else root.style.removeProperty(key);
    }
    return () => {
      delete root.dataset.uiStyle;
      delete root.dataset.density;
      delete root.dataset.workspaceBackground;
      for (const key of Object.keys(properties)) root.style.removeProperty(key);
    };
  }, [
    appearance.uiStyle,
    appearance.density,
    appearance.accent,
    hasBackground,
  ]);

  return (
    <>
      {hasBackground && (
        <div className="myhours-background" aria-hidden="true">
          <img
            alt=""
            src={appearance.backgroundImage}
            style={{
              opacity: appearance.backgroundOpacity,
              filter: `blur(${appearance.backgroundBlur}px)`,
            }}
          />
        </div>
      )}
      {motion && appearance.weatherEffect !== "none" && (
        <Weather
          mode={appearance.weatherEffect}
          intensity={appearance.effectIntensity}
        />
      )}
      {motion &&
        appearance.cursorTrail !== "off" &&
        (appearance.cursorTrail !== "custom" || appearance.cursorImage) && (
          <CursorTrail
            mode={appearance.cursorTrail}
            image={appearance.cursorImage}
            size={appearance.cursorSize}
          />
        )}
    </>
  );
}
