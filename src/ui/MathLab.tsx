import { useEffect, useId, useMemo, useRef, useState, type PointerEvent } from "react";
import { BookOpen, Calculator, ChartNoAxesCombined, FilePlus, Minus, Plus, RotateCcw, X } from "lucide-react";
import { compileMath, formatMath, gridStep, sampleCurve, validPlotWindow, type AngleUnit, type MathFunction, type PlotWindow } from "../domain/math";
import { Button } from "./components";
import { useApp } from "./context";
import "./math.css";

const standardWindow: PlotWindow = { xMin: -10, xMax: 10, yMin: -8, yMax: 8 };
const colors = ["#19b597", "#db677f", "#688cff", "#d28824"];
const keypad = ["7", "8", "9", "÷", "sin(", "cos(", "4", "5", "6", "×", "tan(", "sqrt(", "1", "2", "3", "−", "ln(", "log(", "0", ".", "π", "+", "(", ")", "x", "e", "ans", "^", "abs(", "fact("];

interface Curve {
  id: number;
  input: string;
}
interface CompiledCurve extends Curve {
  color: string;
  evaluate?: MathFunction;
  error?: string;
}
interface Calculation {
  expression: string;
  value: number;
  x: number;
  unit: AngleUnit;
}

export default function MathLab() {
  const { edit, navigate } = useApp();
  const [unit, setUnit] = useState<AngleUnit>("rad");
  const [expression, setExpression] = useState("");
  const [xInput, setXInput] = useState("0");
  const [history, setHistory] = useState<Calculation[]>([]);
  const [calculatorError, setCalculatorError] = useState("");
  const [curves, setCurves] = useState<Curve[]>([{ id: 0, input: "x^2" }]);
  const [window, setWindow] = useState(standardWindow);
  const [windowDraft, setWindowDraft] = useState(window);
  const [windowError, setWindowError] = useState("");
  const [dragEnabled, setDragEnabled] = useState(false);
  const [stepInput, setStepInput] = useState("1");
  const nextCurve = useRef(1);
  const inputRef = useRef<HTMLInputElement>(null);
  const compiled = useMemo<CompiledCurve[]>(() => curves.map((curve, index) => {
    const color = colors[index];
    if (!curve.input.trim()) return { ...curve, color };
    try { return { ...curve, color, evaluate: compileMath(curve.input) }; }
    catch (error) { return { ...curve, color, error: error instanceof Error ? error.message : String(error) }; }
  }), [curves]);
  const lastResult = history[0]?.value;
  const x = xInput.trim() ? Number(xInput) : NaN;

  function calculate() {
    if (!Number.isFinite(x)) {
      setCalculatorError("Enter a valid value for x.");
      return;
    }
    try {
      const result = compileMath(expression)(x, unit, lastResult);
      if (!Number.isFinite(result)) throw new Error("The expression is undefined or outside the numeric range at this input.");
      setHistory((previous) => [{ expression: expression.trim(), value: result, x, unit }, ...previous.slice(0, 9)]);
      setCalculatorError("");
    } catch (error) {
      setCalculatorError(error instanceof Error ? error.message : String(error));
    }
  }

  function insert(token: string) {
    const input = inputRef.current;
    const start = input?.selectionStart ?? expression.length;
    const end = input?.selectionEnd ?? start;
    const next = expression.slice(0, start) + token + expression.slice(end);
    if (next.length > 256) return;
    setExpression(next);
    requestAnimationFrame(() => { input?.focus(); input?.setSelectionRange(start + token.length, start + token.length); });
  }

  function updateWindow(next: PlotWindow) {
    if (!validPlotWindow(next)) {
      setWindowError("Each axis needs finite bounds in increasing order with a span of at least 0.000001.");
      return;
    }
    setWindow(next);
    setWindowDraft(next);
    setWindowError("");
  }

  function zoom(factor: number) {
    const midX = (window.xMin + window.xMax) / 2;
    const midY = (window.yMin + window.yMax) / 2;
    const halfX = (window.xMax - window.xMin) * factor / 2;
    const halfY = (window.yMax - window.yMin) * factor / 2;
    updateWindow({ xMin: midX - halfX, xMax: midX + halfX, yMin: midY - halfY, yMax: midY + halfY });
  }

  function saveNote() {
    const calculations = history.map((item) => `- ${item.expression} = ${formatMath(item.value)} (x = ${item.x}, ${item.unit})`);
    const graph = curves.flatMap((curve) => curve.input.trim() ? [`- ${curve.input}`] : []);
    edit("note", undefined, { title: "Math Lab work", notebook: "Math", body: ["## Calculations", ...calculations, "", "## Graph expressions", ...graph, "", "## What I observed", ""].join("\n") });
  }

  return (
    <div className="math-lab">
      <header className="math-heading">
        <div><h1>Math Lab</h1><p className="hint">Evaluate expressions, compare graphs, and keep your working.</p></div>
        <div className="math-controls"><Button variant="ghost" onClick={() => navigate("learn")}><BookOpen size={16} /> Lessons</Button><Button variant="secondary" onClick={saveNote}><FilePlus size={16} /> Draft a note</Button></div>
      </header>
      <div className="math-lab-grid">
        <section className="panel math-panel" aria-labelledby="math-calculator-heading">
          <h2 id="math-calculator-heading"><Calculator size={19} /> Scientific calculator</h2>
          <form className="math-calc-form" onSubmit={(event) => { event.preventDefault(); calculate(); }}>
            <label htmlFor="math-expression">Expression</label>
            <input id="math-expression" ref={inputRef} autoComplete="off" spellCheck={false} placeholder="sqrt(81) + 2^3" maxLength={256} value={expression} onChange={(event) => setExpression(event.target.value)} />
            <div className="math-settings">
              <label>Angle unit <select value={unit} onChange={(event) => setUnit(event.target.value === "deg" ? "deg" : "rad")}><option value="rad">Radians</option><option value="deg">Degrees</option></select></label>
              <label>Value of x <input type="number" step="any" value={xInput} onChange={(event) => setXInput(event.target.value)} /></label>
            </div>
            <div className="math-keypad" aria-label="Calculator keypad">
              {keypad.map((token) => <button className="math-key" key={token} type="button" onClick={() => insert(token)}>{token}</button>)}
            </div>
            <div className="math-controls"><Button type="submit" disabled={!expression.trim()}>Calculate</Button><Button type="button" variant="ghost" onClick={() => { setExpression(""); setCalculatorError(""); inputRef.current?.focus(); }}>Clear expression</Button></div>
          </form>
          {calculatorError ? <p className="math-error" role="alert">{calculatorError}</p> : null}
          <div className="math-result" aria-live="polite">
            <span>Result</span>
            <output>{lastResult !== undefined ? formatMath(lastResult) : "—"}</output>
          </div>
          {history.length > 1 ? <details><summary>Recent calculations ({history.length})</summary><ol className="math-calculations">{history.map((item, index) => <li key={index}><button type="button" onClick={() => { setExpression(item.expression); setXInput(String(item.x)); setUnit(item.unit); }}>{item.expression} = {formatMath(item.value)}</button></li>)}</ol></details> : null}
          <details className="math-help"><summary>Supported notation</summary><p className="hint">Use x, pi, e, tau, ans, +, −, ×, ÷, ^, and % for remainder. Examples include 2x, sin(x), sqrt(x), ln(x), log(x, 2), abs(x), fact(x), and 2.5e-3. Results use decimal approximations.</p></details>
        </section>
        <section className="panel math-panel" aria-labelledby="math-graph-heading">
          <h2 id="math-graph-heading"><ChartNoAxesCombined size={19} /> Graphing calculator</h2>
          <div className="math-curve-list">
            {compiled.map((curve, index) => (
              <div className="math-curve-row" key={curve.id}>
                <label><span className="math-curve-swatch" style={{ background: curve.color }} /> <span className="sr-only">Expression {index + 1}</span><span aria-hidden="true">f{index + 1}(x)</span><input aria-invalid={!!curve.error} placeholder="e.g. sin(x)" maxLength={256} autoComplete="off" spellCheck={false} value={curve.input} onChange={(event) => { setCurves((previous) => previous.map((item) => item.id === curve.id ? { ...item, input: event.target.value } : item)); }} /></label>
                <button className="icon-button" type="button" aria-label={`Remove expression ${index + 1}`} disabled={curves.length < 2} onClick={() => setCurves((previous) => previous.filter((item) => item.id !== curve.id))}><X size={16} /></button>
                {curve.error ? <p className="math-error">{curve.error}</p> : null}
              </div>
            ))}
          </div>
          <div className="math-controls graph-controls">
            <Button type="button" variant="secondary" disabled={curves.length >= colors.length} onClick={() => setCurves((previous) => [...previous, { id: nextCurve.current++, input: "" }])}><Plus size={14} /> Expression</Button>
            {expression.trim() && curves.length < colors.length ? <Button type="button" variant="ghost" onClick={() => setCurves((previous) => [...previous, { id: nextCurve.current++, input: expression }])}>Plot calculator input</Button> : null}
            <button className="icon-button" type="button" aria-label="Zoom in" onClick={() => zoom(.7)}><Plus size={18} /></button>
            <button className="icon-button" type="button" aria-label="Zoom out" onClick={() => zoom(1 / .7)}><Minus size={18} /></button>
            <button className="icon-button" type="button" aria-label="Reset graph window" onClick={() => updateWindow(standardWindow)}><RotateCcw size={16} /></button>
          </div>
          <Graph curves={compiled} bounds={window} unit={unit} ans={lastResult} probe={x} onProbe={(value) => setXInput(formatMath(value))} dragEnabled={dragEnabled} onPan={updateWindow} />
          <p className="hint math-graph-caption">Click the canvas to inspect a value of x, or enter it in the calculator. Graphs are sampled and may miss narrow features.</p>
          <details>
            <summary>Graph window and panning</summary>
            <form className="math-window" onSubmit={(event) => { event.preventDefault(); updateWindow(windowDraft); }}>
              {([["xMin", "x minimum"], ["xMax", "x maximum"], ["yMin", "y minimum"], ["yMax", "y maximum"]] as const).map(([key, label]) => <label key={key}>{label}<input type="number" step="any" required value={Number.isFinite(windowDraft[key]) ? windowDraft[key] : ""} onChange={(event) => setWindowDraft((previous) => ({ ...previous, [key]: event.target.valueAsNumber }))} /></label>)}
              <Button type="submit" variant="secondary">Apply window</Button>
              <label className="check-label math-drag-toggle"><input type="checkbox" checked={dragEnabled} onChange={(event) => setDragEnabled(event.target.checked)} /> Enable drag to pan</label>
            </form>
          </details>
          {windowError ? <p className="math-error" role="alert">{windowError}</p> : null}
          <details className="math-table-details">
            <summary>Table of values</summary>
            <ValueTable curves={compiled} unit={unit} x={x} ans={lastResult} stepInput={stepInput} setStepInput={setStepInput} />
          </details>
        </section>
      </div>
    </div>
  );
}

function gridLines(minimum: number, maximum: number) {
  const step = gridStep(maximum - minimum);
  const start = Math.ceil(minimum / step) * step;
  return Array.from({ length: Math.max(0, Math.floor((maximum - start) / step + 1e-9) + 1) }, (_, index) => start + index * step);
}

function Graph({ curves, bounds, unit, ans, probe, onProbe, dragEnabled, onPan }: {
  curves: CompiledCurve[]; bounds: PlotWindow; unit: AngleUnit; ans?: number; probe: number;
  onProbe: (value: number) => void; dragEnabled: boolean; onPan: (bounds: PlotWindow) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 700, height: 360 });
  const pointer = useRef<{ x: number; y: number; bounds: PlotWindow; moved: boolean } | null>(null);
  const clip = useId();
  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setSize({ width, height });
    });
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);

  const margin = { left: 42, right: 13, top: 13, bottom: 30 };
  const width = Math.max(1, size.width - margin.left - margin.right);
  const height = Math.max(1, size.height - margin.top - margin.bottom);
  const rangeX = bounds.xMax - bounds.xMin, rangeY = bounds.yMax - bounds.yMin;
  const px = (x: number) => margin.left + (x - bounds.xMin) / rangeX * width;
  const py = (y: number) => margin.top + (bounds.yMax - y) / rangeY * height;
  const plots = useMemo(() => curves.map((curve) => ({
    curve,
    segments: curve.evaluate ? sampleCurve((x) => curve.evaluate!(x, unit, ans), bounds) : [],
  })), [curves, bounds, unit, ans]);
  const probeVisible = Number.isFinite(probe) && probe >= bounds.xMin && probe <= bounds.xMax;

  function handleDown(event: PointerEvent<SVGSVGElement>) {
    if (event.button !== 0) return;
    pointer.current = { x: event.clientX, y: event.clientY, bounds, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function handleDrag(event: PointerEvent<SVGSVGElement>) {
    const down = pointer.current;
    if (!down) return;
    const dx = event.clientX - down.x, dy = event.clientY - down.y;
    if (Math.hypot(dx, dy) > 5) down.moved = true;
    if (!dragEnabled || !down.moved) return;
    const unitsX = dx / width * rangeX, unitsY = dy / height * rangeY;
    onPan({ xMin: down.bounds.xMin - unitsX, xMax: down.bounds.xMax - unitsX, yMin: down.bounds.yMin + unitsY, yMax: down.bounds.yMax + unitsY });
  }
  function handleUp(event: PointerEvent<SVGSVGElement>) {
    const down = pointer.current;
    pointer.current = null;
    if (!down || down.moved) return;
    const relative = event.clientX - event.currentTarget.getBoundingClientRect().left - margin.left;
    if (relative >= 0 && relative <= width) onProbe(bounds.xMin + relative * rangeX / width);
  }

  return <div className="math-chart" ref={container}>
    <svg viewBox={`0 0 ${size.width} ${size.height}`} role="img" aria-label="Function graph. Use the value of x and the table for keyboard inspection." className={dragEnabled ? "math-svg drag" : "math-svg"} onPointerDown={handleDown} onPointerMove={handleDrag} onPointerUp={handleUp} onPointerCancel={() => { pointer.current = null; }}>
      <defs><clipPath id={clip}><rect x={margin.left} y={margin.top} width={width} height={height} /></clipPath></defs>
      {gridLines(bounds.xMin, bounds.xMax).map((x) => <g key={x}><line x1={px(x)} x2={px(x)} y1={margin.top} y2={height + margin.top} className="math-gridline" /><text x={px(x)} y={height + margin.top + 20} textAnchor="middle">{formatMath(x)}</text></g>)}
      {gridLines(bounds.yMin, bounds.yMax).map((y) => <g key={y}><line x1={margin.left} x2={margin.left + width} y1={py(y)} y2={py(y)} className="math-gridline" /><text x={margin.left - 6} y={py(y) + 4} textAnchor="end">{formatMath(y)}</text></g>)}
      <g clipPath={`url(#${clip})`}>
        <line x1={px(0)} x2={px(0)} y1={margin.top} y2={height + margin.top} className="math-axis" />
        <line x1={margin.left} x2={margin.left + width} y1={py(0)} y2={py(0)} className="math-axis" />
        {plots.map(({ curve, segments }) => <path key={curve.id} d={segments.map((segment) => segment.map((point, index) => `${index ? "L" : "M"}${px(point.x).toFixed(2)} ${py(point.y).toFixed(2)}`).join(" ")).join(" ")} fill="none" stroke={curve.color} strokeWidth="2.1" />)}
        {probeVisible ? <><line x1={px(probe)} x2={px(probe)} y1={margin.top} y2={margin.top + height} className="math-probe" />{curves.map((curve) => {
          const value = curve.evaluate?.(probe, unit, ans);
          return value !== undefined && Number.isFinite(value) && value >= bounds.yMin && value <= bounds.yMax ? <circle key={curve.id} cx={px(probe)} cy={py(value)} r="4" fill={curve.color} /> : null;
        })}</> : null}
      </g>
    </svg>
  </div>;
}

function ValueTable({ curves, unit, x, ans, stepInput, setStepInput }: { curves: CompiledCurve[]; unit: AngleUnit; x: number; ans?: number; stepInput: string; setStepInput: (value: string) => void }) {
  const step = Number(stepInput);
  const valid = Number.isFinite(x) && Number.isFinite(step) && step > 0;
  return <div className="math-values">
    <label>Table step<input type="number" min="0.000001" step="any" value={stepInput} onChange={(event) => setStepInput(event.target.value)} /></label>
    {valid ? <div className="math-table-scroll"><table><thead><tr><th scope="col">x</th>{curves.map((curve, index) => <th key={curve.id} scope="col" title={curve.input}>f{index + 1}(x)</th>)}</tr></thead><tbody>{Array.from({ length: 7 }, (_, index) => x + (index - 3) * step).map((value, index) => <tr key={index}><th scope="row">{formatMath(value)}</th>{curves.map((curve) => <td key={curve.id}>{curve.evaluate ? formatMath(curve.evaluate(value, unit, ans)) : "—"}</td>)}</tr>)}</tbody></table></div> : <p className="hint">Enter a finite x value and a positive table step.</p>}
  </div>;
}
