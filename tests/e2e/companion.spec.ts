import { expect, test } from "@playwright/test";

test("companion answers locally, requires hosted consent, and can stop walking", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("./");
  await page.getByRole("button", { name: "Skip setup" }).click();
  await page.goto("./#/appearance");
  const companionToggle = page.getByRole("switch", {
    name: "Enable roaming companion",
  });
  if (!(await companionToggle.isChecked())) {
    await companionToggle.click();
    await expect(companionToggle).toBeChecked();
  }
  await page.goto("./#/today");

  const companion = page.getByRole("button", { name: "Ask Pip", exact: true });
  await expect(companion).toBeVisible();
  await expect(page.locator(".companion-roam")).toHaveCSS(
    "animation-name",
    "none",
  );
  await companion.click();

  const dialog = page.getByRole("dialog", { name: "Ask Pip" });
  await dialog.getByRole("button", { name: "What is overdue?" }).click();
  await expect(
    dialog.getByText("No open items with a past recorded deadline", {
      exact: false,
    }),
  ).toBeVisible();

  await dialog.getByLabel("Answer mode").selectOption("hosted");
  const submit = dialog.getByRole("button", { name: "Ask", exact: true });
  await expect(submit).toBeDisabled();
  await expect(
    dialog.getByLabel("Include these workspace records"),
  ).not.toBeChecked();
  await dialog.getByLabel("Send this question to the AI provider").check();
  await expect(submit).toBeEnabled();
  await dialog.getByLabel("Your question").fill("What should I do next?");
  await expect(submit).toBeDisabled();

  await dialog.getByRole("button", { name: "Pause walking" }).click();
  await expect(
    dialog.getByRole("button", { name: "Resume walking" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(page.locator(".companion-rail")).toHaveAttribute(
    "data-walking",
    "off",
  );
});
