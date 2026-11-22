import jsep from "jsep";

export type AngleUnit = "rad" | "deg";
export type MathFunction = (x: number, unit: AngleUnit, ans?: number) => number;

const radians = (value: number, unit: AngleUnit) => unit === "deg" ? value * Math.PI / 180 : value;
const angle = (value: number, unit: AngleUnit) => unit === "deg" ? value * 180 / Math.PI : value;
type ScientificFunction = { min: number; max: number; call: (values: number[], unit: AngleUnit) => number };
const one = (fn: (value: number) => number): ScientificFunction => ({ min: 1, max: 1, call: ([value]) => fn(value) });
const trig = (fn: (value: number) => number): ScientificFunction => ({ min: 1, max: 1, call: ([value], unit) => fn(radians(value, unit)) });
const inverse = (fn: (value: number) => number): ScientificFunction => ({ min: 1, max: 1, call: ([value], unit) => angle(fn(value), unit) });
const factorial = (value: number) => {
  if (!Number.isInteger(value) || value < 0 || value > 170) return NaN;
  let result = 1;
  for (let n = 2; n <= value; n++) result *= n;
  return result;
};
const functions = new Map<string, ScientificFunction>(Object.entries({
  sin: trig(Math.sin), cos: trig(Math.cos),
  tan: trig((value) => Math.abs(Math.cos(value)) < 1e-13 ? NaN : Math.tan(value)),
  asin: inverse(Math.asin), acos: inverse(Math.acos), atan: inverse(Math.atan),
  sinh: one(Math.sinh), cosh: one(Math.cosh), tanh: one(Math.tanh),
  sqrt: one(Math.sqrt), cbrt: one(Math.cbrt), abs: one(Math.abs),
  ln: one(Math.log), log10: one(Math.log10), log2: one(Math.log2), exp: one(Math.exp),
  log: { min: 1, max: 2, call: ([value, base = 10]: number[]) => base > 0 && base !== 1 ? Math.log(value) / Math.log(base) : NaN },
  pow: { min: 2, max: 2, call: ([base, exponent]: number[]) => base ** exponent },
  min: { min: 1, max: 12, call: (values: number[]) => Math.min(...values) },
  max: { min: 1, max: 12, call: (values: number[]) => Math.max(...values) },
  floor: one(Math.floor), ceil: one(Math.ceil), round: one(Math.round),
  fact: one(factorial), sign: one(Math.sign),
}));

// A grouping node distinguishes (-x)^2 from the conventional interpretation -(x^2).
jsep.hooks.add("gobble-token", function (environment) {
  if (this.char !== "(") return;
  const argument = this.gobbleGroup();
  if (!argument) this.throwError("Expected an expression inside parentheses");
  environment.node = { type: "MathGroup", argument };
});

const numberToken = /^(?:\d|\.)/;
const nameToken = /^[a-z][a-z\d]*$/;

function normalizeExpression(expression: string) {
  const source = expression.trim().toLowerCase()
    .replace(/^\s*(?:y|f\(x\))\s*=\s*/, "")
    .replace(/π/g, "pi").replace(/τ/g, "tau").replace(/−/g, "-")
    .replace(/[×·]/g, "*").replace(/÷/g, "/").replace(/²/g, "**2").replace(/³/g, "**3")
    .replace(/\^/g, "**");
  if (!source) throw new Error("Enter an expression.");
  if (source.length > 256) throw new Error("Use an expression of 256 characters or fewer.");
  const tokens = source.match(/(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|[a-z][a-z\d]*|\*\*|[+*/%(),-]/g) ?? [];
  if (tokens.join("") !== source.replace(/\s+/g, "")) throw new Error("Use numbers, x, supported functions and math operators.");
  return tokens.map((token, index) => {
    const previous = tokens[index - 1];
    if (!previous) return token;
    if (numberToken.test(previous) && numberToken.test(token)) throw new Error("Place an operator between numbers.");
    const implicit = (
      (numberToken.test(previous) || previous === ")" || ["x", "e", "pi", "tau", "ans"].includes(previous)) &&
      (token === "(" || nameToken.test(token))
    );
    return implicit ? `*${token}` : token;
  }).join("");
}

const operators = new Map<string, (a: number, b: number) => number>([
  ["+", (a, b) => a + b], ["-", (a, b) => a - b], ["*", (a, b) => a * b],
  ["/", (a, b) => b === 0 ? NaN : a / b], ["%", (a, b) => a % b], ["**", (a, b) => a ** b],
]);

function compileNode(node: jsep.Expression, depth = 0): MathFunction {
  if (depth > 48) throw new Error("Expression is nested too deeply.");
  const child = (expression: jsep.Expression) => compileNode(expression, depth + 1);
  switch (node.type) {
    case "MathGroup":
      return child(node.argument as jsep.Expression);
    case "Literal": {
      const { value } = node as jsep.Literal;
      if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("Only finite numbers are supported.");
      return () => value;
    }
    case "Identifier": {
      const { name } = node as jsep.Identifier;
      switch (name) {
        case "x": return (x) => x;
        case "pi": return () => Math.PI;
        case "tau": return () => Math.PI * 2;
        case "e": return () => Math.E;
        case "ans": return (_x, _unit, ans) => ans ?? NaN;
        default: throw new Error(`Unknown symbol: ${name}.`);
      }
    }
    case "UnaryExpression": {
      const { operator, argument } = node as jsep.UnaryExpression;
      const value = child(argument);
      if (operator === "+") return value;
      if (operator === "-") return (x, unit, ans) => -value(x, unit, ans);
      break;
    }
    case "BinaryExpression": {
      const { operator, right } = node as jsep.BinaryExpression;
      let { left } = node as jsep.BinaryExpression;
      const operation = operators.get(operator);
      if (!operation) throw new Error(`Unsupported operator: ${operator}.`);
      let sign = 1;
      while (operator === "**" && left.type === "UnaryExpression") {
        const unary = left as jsep.UnaryExpression;
        if (unary.operator === "-") sign *= -1;
        left = unary.argument;
      }
      const a = child(left), b = child(right);
      return (x, unit, ans) => sign * operation(a(x, unit, ans), b(x, unit, ans));
    }
    case "CallExpression": {
      const call = node as jsep.CallExpression;
      if (call.callee.type !== "Identifier") break;
      const { name } = call.callee as jsep.Identifier;
      const mathFunction = functions.get(name);
      if (!mathFunction) throw new Error(`Unsupported function: ${name}.`);
      if (call.arguments.length < mathFunction.min || call.arguments.length > mathFunction.max) {
        const count = mathFunction.min === mathFunction.max ? String(mathFunction.min) : `${mathFunction.min}–${mathFunction.max}`;
        throw new Error(`${name} expects ${count} argument(s).`);
      }
      const args = call.arguments.map(child);
      return (x, unit, ans) => mathFunction.call(args.map((arg) => arg(x, unit, ans)), unit);
    }
  }
  throw new Error("Unsupported syntax. Use math expressions only.");
}

export function compileMath(input: string): MathFunction {
  const expression = normalizeExpression(input);
  let ast: jsep.Expression;
  try {
    ast = jsep(expression);
  } catch {
    throw new Error("Check parentheses, operators and function arguments.");
  }
  return compileNode(ast);
}

export function formatMath(value: number): string {
  if (!Number.isFinite(value)) return "Undefined";
  return Number(value.toPrecision(12)).toString();
}

export interface PlotWindow { xMin: number; xMax: number; yMin: number; yMax: number }
export interface PlotPoint { x: number; y: number }

export function validPlotWindow(bounds: PlotWindow) {
  return Object.values(bounds).every((value) => Number.isFinite(value) && Math.abs(value) <= 1e9) &&
    bounds.xMax - bounds.xMin >= 1e-6 && bounds.yMax - bounds.yMin >= 1e-6;
}

export function sampleCurve(evaluate: (x: number) => number, bounds: PlotWindow, count = 700): PlotPoint[][] {
  if (!validPlotWindow(bounds)) return [];
  const segments: PlotPoint[][] = [];
  let segment: PlotPoint[] = [];
  const height = bounds.yMax - bounds.yMin;
  const flush = () => { if (segment.length > 1) segments.push(segment); segment = []; };
  for (let i = 0; i <= count; i++) {
    const x = bounds.xMin + (bounds.xMax - bounds.xMin) * i / count;
    const y = evaluate(x);
    if (!Number.isFinite(y) || y < bounds.yMin - 4 * height || y > bounds.yMax + 4 * height) {
      flush();
      continue;
    }
    const prior = segment.at(-1);
    if (prior && Math.abs(y - prior.y) > height) {
      const midpoint = evaluate((x + prior.x) / 2);
      const deviation = Math.abs(midpoint - (y + prior.y) / 2);
      if (!Number.isFinite(midpoint) || deviation > height / 3) flush();
    }
    segment.push({ x, y });
  }
  flush();
  return segments;
}

export function gridStep(span: number, preferredLines = 8) {
  const step = span / preferredLines;
  const magnitude = 10 ** Math.floor(Math.log10(step));
  return magnitude * ([1, 2, 5, 10].find((candidate) => candidate >= step / magnitude) ?? 10);
}
