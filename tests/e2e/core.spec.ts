import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
async function start(page: import("@playwright/test").Page) {
  await page.goto("./");
  await page.getByRole("button", { name: "Skip setup" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}
async function route(page: import("@playwright/test").Page, name: string) {
  await page.goto("./#/" + name);
}
test("task CRUD persists offline and undo restores deleted data", async ({
  page,
  context,
}) => {
  await start(page);
  await route(page, "tasks");
  await page
    .getByRole("button", { name: "Add task", exact: true })
    .first()
    .click();
  await page.getByLabel("Title", { exact: true }).fill("Finish real homework");
  await page.getByRole("button", { name: "Save task", exact: true }).click();
  await expect(
    page.getByText("Finish real homework", { exact: true }),
  ).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByText("Finish real homework", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Complete Finish real homework", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Reopen Finish real homework",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Edit Finish real homework", exact: true })
    .click();
  await page.getByLabel("Title", { exact: true }).fill("Homework checked");
  await page.getByRole("button", { name: "Save task", exact: true }).click();
  await page
    .getByRole("button", { name: "Edit Homework checked", exact: true })
    .click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page
    .getByRole("button", { name: "Confirm delete", exact: true })
    .click();
  await expect(
    page.locator(".record-title").filter({ hasText: "Homework checked" }),
  ).not.toBeVisible();
  await page.getByRole("button", { name: "Undo delete" }).click();
  await expect(
    page.locator(".record-title").filter({ hasText: "Homework checked" }),
  ).toBeVisible();
});
test("notes autosave across reload and render HTML safely", async ({
  page,
}) => {
  await start(page);
  await route(page, "notes");
  await page.getByRole("button", { name: "New note", exact: true }).click();
  await page
    .getByLabel("Note title", { exact: true })
    .fill("Equation reasoning");
  await page
    .getByLabel("Note body", { exact: true })
    .fill("## A correction\nCheck both sides. <script>alert(1)</script>");
  await expect(
    page.getByRole("status").filter({ hasText: "Saved on this device" }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Note body", { exact: true })).toHaveValue(
    /Check both sides/,
  );
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "A correction" }),
  ).toBeVisible();
  expect(await page.locator(".markdown-preview script").count()).toBe(0);
});
test("course and assignment data are real; grades remain unknown without weights", async ({
  page,
}) => {
  await start(page);
  await route(page, "school");
  await page
    .getByRole("button", { name: "Add course", exact: true })
    .first()
    .click();
  await page.getByLabel("Title", { exact: true }).fill("Test Math");
  await page.getByRole("button", { name: "Save course", exact: true }).click();
  await page.getByRole("button", { name: "Assignments", exact: true }).click();
  await page
    .getByRole("button", { name: "Add assignment", exact: true })
    .first()
    .click();
  await page.getByLabel("Title", { exact: true }).fill("Equation worksheet");
  await page
    .getByLabel("Course", { exact: true })
    .selectOption({ label: "Test Math" });
  await page
    .getByRole("button", { name: "Save assignment", exact: true })
    .click();
  await expect(
    page.getByText("Equation worksheet", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Gradebook", exact: true }).click();
  await page
    .getByRole("button", { name: "Add assessment", exact: true })
    .first()
    .click();
  await page.getByLabel("Title", { exact: true }).fill("Quiz");
  await page
    .getByLabel("Course", { exact: true })
    .selectOption({ label: "Test Math" });
  await page.getByLabel("Grade category", { exact: true }).fill("Quizzes");
  await page.getByLabel("Grade status", { exact: true }).selectOption("graded");
  await page.getByLabel("Points earned", { exact: true }).fill("9");
  await page.getByLabel("Points possible", { exact: true }).fill("10");
  await page
    .getByRole("button", { name: "Save assessment", exact: true })
    .click();
  await page
    .getByLabel("Grade calculation course")
    .selectOption({ label: "Test Math" });
  await expect(
    page.getByText("Overall grade unknown", { exact: true }),
  ).toBeVisible();
});
test("real fixed conflicts and schedule confirmation", async ({ page }) => {
  await start(page);
  await route(page, "calendar");
  for (const [title, start, end] of [
    ["Practice", "2026-11-21T17:00", "2026-11-21T18:00"],
    ["Family", "2026-11-21T17:30", "2026-11-21T18:30"],
  ]) {
    await page.getByRole("button", { name: "Add event", exact: true }).click();
    await page.getByLabel("Title", { exact: true }).fill(title);
    await page.getByLabel("Starts", { exact: true }).fill(start);
    await page.getByLabel("Ends", { exact: true }).fill(end);
    await page.getByRole("button", { name: "Save event", exact: true }).click();
  }
  await page.getByLabel("Calendar date", { exact: true }).fill("2026-11-21");
  await expect(
    page.getByText("Practice overlaps Family", { exact: false }),
  ).toBeVisible();
});
test("all routes fit phone and desktop; keyboard and accessibility", async ({
  page,
}) => {
  await start(page);
  for (const name of [
    "today",
    "tasks",
    "school",
    "imports",
    "routines",
    "calendar",
    "notes",
    "textbooks",
    "learn",
    "math",
    "music",
    "appearance",
    "login",
    "account",
    "memory",
    "connections",
    "privacy",
    "info",
    "projects",
    "learning",
    "life",
    "money",
    "explore",
    "roadmap",
    "review",
    "ai",
    "settings",
  ]) {
    await route(page, name);
    await expect(page.locator("main h1")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true);
  }
  await route(page, "today");
  await page.keyboard.press("Control+k");
  await expect(
    page.getByRole("dialog", { name: "Find anything" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.emulateMedia({ reducedMotion: "reduce" });
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
test("seven-day routines save edits and keep today's check-offs after reload", async ({
  page,
}) => {
  await start(page);
  await route(page, "routines");
  await expect(page.getByRole("heading", { name: "A rhythm that fits." })).toBeVisible();
  const currentDay = page.locator(".routine-days button").filter({ hasText: "Today" });
  await expect(currentDay).toHaveCount(1);
  const plan = page.getByLabel(/checklist$/i);
  await plan.fill("Wash up and eat.\nPack the things I actually need.\nChoose one real task after a break.");
  await page.getByRole("button", { name: "Save this day" }).click();
  await page.getByRole("button", { name: "Complete: Wash up and eat." }).click();
  await expect(page.getByText("1 of 3 steps checked today.")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Uncheck: Wash up and eat." })).toBeVisible();
});
test("Math Lab evaluates scientific expressions and plots functions", async ({
  page,
}) => {
  await start(page);
  await route(page, "math");
  await page.getByLabel("Expression", { exact: true }).fill("sqrt(81) + 2^3");
  await page.getByRole("button", { name: "Calculate", exact: true }).click();
  await expect(page.locator(".math-result output")).toHaveText("17");
  await expect(page.locator(".math-svg path").first()).toBeVisible();
});
test("textbook shelf keeps external sources separate and makes private notes", async ({
  page,
}) => {
  await start(page);
  await route(page, "textbooks");
  await expect(page.getByRole("heading", { name: "Books, courses, and tools." })).toBeVisible();
  const openStax = page.locator(".textbook-entry").filter({ hasText: "OpenStax" });
  await expect(openStax.getByRole("link", { name: /Open source/ })).toHaveAttribute("href", "https://openstax.org/subjects");
  await openStax.getByRole("button", { name: "Add notes" }).click();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Reading notes · OpenStax");
});
test("snapshot export requires category selection and stays private", async ({
  page,
}) => {
  await start(page);
  await route(page, "privacy");
  await page.getByRole("button", { name: "Choose data and preview" }).click();
  await expect(
    page.getByText("Share a read-only snapshot", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Ledger", { exact: true })).not.toBeChecked();
  await expect(page.getByLabel("Notes", { exact: true })).not.toBeChecked();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "JSON snapshot", exact: true })
    .click();
  expect((await download).suggestedFilename()).toBe(
    "myhours-readonly.json",
  );
});
test("restore preview preserves a complete fixture and maps only actual links", async ({
  page,
}) => {
  await start(page);
  await route(page, "privacy");
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles("examples/fake-backup.json");
  await expect(
    page.getByRole("heading", { name: "Confirm backup restore" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Confirm replace and restore" })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await route(page, "notes");
  await expect(page.getByLabel("Note title")).toHaveValue(
    "Example note (fictional)",
  );
  await page
    .getByRole("button", { name: "Knowledge map", exact: true })
    .click();
  await expect(page.locator(".map-node")).toHaveCount(3);
  await expect(page.locator(".knowledge-map line")).toHaveCount(1);
  await route(page, "tasks");
  await expect(
    page.getByText("Example task (fictional)", { exact: true }),
  ).toBeVisible();
});
test("practice and baseline support a cited local draft without automatic writes", async ({
  page,
}) => {
  await start(page);
  await route(page, "learning");
  await page.getByRole("button", { name: "Focus areas", exact: true }).click();
  await page
    .getByRole("button", { name: "Add focus area", exact: true })
    .first()
    .click();
  await page.getByLabel("Title", { exact: true }).fill("Explain equations");
  await page.getByLabel("Role", { exact: true }).selectOption("primary");
  await page
    .getByLabel("Baseline evidence / artifact link")
    .fill("Can explain one-step equations; two-step reasoning needs review.");
  await page
    .getByRole("button", { name: "Save focus area", exact: true })
    .click();
  await page.getByRole("button", { name: "Practice log", exact: true }).click();
  await page
    .getByRole("button", { name: "Add practice attempt", exact: true })
    .first()
    .click();
  await page
    .getByLabel("Title", { exact: true })
    .fill("Two-step equation attempt");
  await page
    .getByLabel("Focus area", { exact: true })
    .selectOption({ label: "Explain equations" });
  await page
    .getByLabel("Actual challenge attempted")
    .fill("Solve and explain a two-step equation.");
  await page
    .getByLabel("What changed?", { exact: true })
    .fill("Apply the same operation to both sides.");
  await page
    .getByRole("button", { name: "Save practice attempt", exact: true })
    .click();
  await route(page, "ai");
  await page.getByRole("checkbox", { name: "focus", exact: true }).check();
  await page.getByRole("checkbox", { name: "practice", exact: true }).check();
  await page
    .getByRole("button", {
      name: "Suggest my next practice challenge",
      exact: true,
    })
    .click();
  await expect(
    page.getByText(/Draft challenge for Explain equations/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Record · Explain equations",
      exact: true,
    }),
  ).toBeVisible();
  await route(page, "tasks");
  await expect(
    page.getByRole("heading", { name: "No tasks yet" }),
  ).toBeVisible();
});
test("school CSV imports require confirmation and skip duplicate source records", async ({
  page,
}) => {
  await start(page);
  await route(page, "imports");
  const file = {
    name: "classes.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "sourcedId,title,classCode\nclass-demo,Fictional Imported Class,P1",
    ),
  };
  await page.locator("input[type=file]").first().setInputFiles(file);
  await page.getByRole("button", { name: "Build import preview" }).click();
  await expect(page.getByText("course · new", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Confirm 1 selected imports" })
    .click();
  await route(page, "school");
  await expect(
    page.getByText("Fictional Imported Class", { exact: true }),
  ).toBeVisible();
  await route(page, "imports");
  await page.locator("input[type=file]").first().setInputFiles(file);
  await page.getByRole("button", { name: "Build import preview" }).click();
  await expect(
    page.getByText("course · duplicate", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirm 0 selected imports" }),
  ).toBeDisabled();
});
test("PDF import extracts a private note locally and image upload requires sign-in", async ({
  page,
}) => {
  await start(page);
  await route(page, "imports");
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles("examples/fake-schedule.pdf");
  await expect(
    page.getByRole("heading", { name: "Review 1 proposed record(s)" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Confirm 1 selected imports" })
    .click();
  await route(page, "notes");
  await expect(page.getByLabel("Note body")).toHaveValue(
    /FICTIONAL TEST SCHEDULE/,
  );
  await route(page, "ai");
  await expect(page.getByLabel("Attach image", { exact: true })).toBeDisabled();
  await page.getByLabel("AI context mode").selectOption("general");
  await expect(
    page.getByText("No app records are included.", { exact: false }),
  ).toBeVisible();
});
