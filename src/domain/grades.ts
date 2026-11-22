import { num, str, type LifeRecord } from "./model";
export function calculateGrade(assessments: LifeRecord[]) {
  const graded = assessments.filter(
    (r) => r.kind === "assessment" && r.data.status === "graded",
  );
  if (!graded.length)
    return {
      value: null,
      explanation:
        "Grades not entered. Add graded assessments with known points.",
    };
  const categories = [...new Set(assessments.map((r) => str(r, "category")))];
  const rows = categories.map((category) => {
    const all = assessments.filter((r) => str(r, "category") === category);
    const items = graded.filter((r) => str(r, "category") === category);
    const weights = [
      ...new Set(all.map((r) => r.data.weight).filter((w) => w !== undefined)),
    ];
    return {
      category,
      earned: items.reduce((s, r) => s + num(r, "earned"), 0),
      possible: items.reduce((s, r) => s + num(r, "possible"), 0),
      weight: weights.length === 1 ? Number(weights[0]) : undefined,
      conflict: weights.length > 1,
    };
  });
  if (
    rows.some((r) => r.weight === undefined || r.conflict || r.possible <= 0) ||
    Math.abs(rows.reduce((s, r) => s + (r.weight ?? 0), 0) - 100) > 0.001
  )
    return {
      value: null,
      explanation:
        "Overall grade unknown. Enter consistent category weights totaling 100% and graded points in every category. Category point totals are still shown.",
      rows,
    };
  const value = rows.reduce(
    (sum, r) => sum + (r.earned / r.possible) * (r.weight ?? 0),
    0,
  );
  return {
    value,
    explanation: rows
      .map((r) => `${r.category}: (${r.earned} ÷ ${r.possible}) × ${r.weight}%`)
      .join(" + "),
    rows,
  };
}
