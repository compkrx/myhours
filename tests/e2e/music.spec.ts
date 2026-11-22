import { expect, test } from "@playwright/test";

function silentWav(seconds: number) {
  const sampleRate = 8000;
  const samples = seconds * sampleRate;
  const bytes = Buffer.alloc(44 + samples * 2);
  bytes.write("RIFF", 0);
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write("WAVEfmt ", 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(sampleRate, 24);
  bytes.writeUInt32LE(sampleRate * 2, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write("data", 36);
  bytes.writeUInt32LE(samples * 2, 40);
  return bytes;
}

test("local music stays selected and playing across in-app routes", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Skip setup" }).click();
  await page.goto("./#/music");
  await page.getByLabel("Add audio files").setInputFiles([
    { name: "Build session.wav", mimeType: "audio/wav", buffer: silentWav(12) },
    {
      name: "Reading session.wav",
      mimeType: "audio/wav",
      buffer: silentWav(12),
    },
  ]);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  await page.goto("./#/today");
  await expect(
    page
      .getByRole("region", { name: "Music player" })
      .getByText("Build session.wav"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Pause music", exact: true }).click();
  await page.getByRole("button", { name: "Open Music page" }).click();
  await expect(
    page.getByRole("button", { name: "Play", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next track" }).click();
  await expect(
    page
      .getByRole("region", { name: "Music player" })
      .getByText("Reading session.wav"),
  ).toBeVisible();
});

test("saved Spotify links load only after a user opens the original embed", async ({
  page,
}) => {
  const player =
    "https://open.spotify.com/embed/playlist/37i9dQZF1DX4Wsb4d7NKfP";
  await page.route(player, (route) =>
    route.fulfill({ contentType: "text/html", body: "<p>Playlist player</p>" }),
  );
  await page.goto("./");
  await page.getByRole("button", { name: "Skip setup" }).click();
  await page.goto("./#/music");
  await page
    .getByLabel("Spotify or YouTube link")
    .fill(
      "https://open.spotify.com/playlist/37i9dQZF1DX4Wsb4d7NKfP?si=example",
    );
  await page.getByLabel("Label (optional)").fill("Focus mix");
  await page.getByRole("button", { name: "Save link" }).click();
  const saved = page.getByRole("button", { name: "Load Focus mix" });
  await expect(saved).toBeVisible();
  const iframe = page.locator('iframe[title="Spotify playlist player"]');
  await expect(iframe).toHaveCount(0);
  await saved.click();
  await expect(iframe).toHaveAttribute("src", player);
  await page.goto("./#/today");
  await expect(iframe).toBeVisible();
  await page.getByRole("button", { name: "Close embedded player" }).click();
  await expect(iframe).toHaveCount(0);
});
