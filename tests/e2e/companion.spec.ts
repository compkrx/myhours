import { expect, test } from "@playwright/test";

test("companion uses the selected local model and can stop walking", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, "gpu", {
      configurable: true,
      value: undefined,
    });
  });
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
  await expect(
    dialog.getByText("Gemma 3 · 1B · free, on this device."),
  ).toBeVisible();
  await expect(
    dialog.getByLabel("Include recent tasks, assignments, events and projects"),
  ).not.toBeChecked();
  await dialog.getByLabel("Your question").fill("What should I do next?");
  await dialog.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "does not support WebGPU",
  );
  await expect(dialog.getByLabel("Answer mode")).toHaveCount(0);

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
