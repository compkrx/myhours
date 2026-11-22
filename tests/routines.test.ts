import { describe, expect, it } from "vitest";
import {
  routineStepId,
  starterRoutines,
  stepsFromPlan,
  week,
  weekdayForDate,
} from "../src/domain/routines";

describe("weekly routine templates", () => {
  it("provides seven different editable starter plans", () => {
    expect(week).toHaveLength(7);
    expect(new Set(Object.values(starterRoutines)).size).toBe(7);
    for (const plan of Object.values(starterRoutines))
      expect(stepsFromPlan(plan).length).toBeGreaterThanOrEqual(4);
  });

  it("uses the calendar date to choose a day and stable step keys", () => {
    expect(weekdayForDate("2026-11-23")).toBe("monday");
    expect(weekdayForDate("2026-11-29")).toBe("sunday");
    expect(routineStepId(1, "Eat before leaving.")).toBe(
      "1:Eat before leaving.",
    );
  });
});
