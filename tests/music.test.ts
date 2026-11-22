import { describe, expect, it } from "vitest";
import { isLocalAudio, parseMusicLink } from "../src/domain/music";

describe("music sources", () => {
  const spotifyId = "37i9dQZF1DX4Wsb4d7NKfP";
  const youtubeList = "PL1234example_-playlist";
  const youtubeId = "dQw4w9WgXcQ";

  it("normalizes Spotify playlist shares and drops tracking parameters", () => {
    const url = `https://open.spotify.com/intl-de/playlist/${spotifyId}?si=share-token`;
    const parsed = parseMusicLink(url);
    expect(parsed).toEqual({
      provider: "Spotify",
      kind: "playlist",
      url: `https://open.spotify.com/playlist/${spotifyId}`,
      embedUrl: `https://open.spotify.com/embed/playlist/${spotifyId}`,
    });
    expect(parseMusicLink(`spotify:playlist:${spotifyId}`)).toEqual(parsed);
  });

  it("keeps the playlist of a YouTube Music share", () => {
    expect(
      parseMusicLink(
        `https://music.youtube.com/watch?v=${youtubeId}&list=${youtubeList}`,
      ),
    ).toMatchObject({
      provider: "YouTube",
      kind: "playlist",
      embedUrl: `https://www.youtube-nocookie.com/embed/videoseries?list=${youtubeList}&playsinline=1`,
    });
    expect(
      parseMusicLink(`https://youtu.be/${youtubeId}?si=share-token`),
    ).toMatchObject({
      provider: "YouTube",
      kind: "video",
      url: `https://www.youtube.com/watch?v=${youtubeId}`,
    });
  });

  it.each([
    `https://open.spotify.com.example/playlist/${spotifyId}`,
    `https://example.com/@open.spotify.com/playlist/${spotifyId}`,
    `https://user:pass@open.spotify.com/playlist/${spotifyId}`,
    `https://open.spotify.com:8443/playlist/${spotifyId}`,
    `http://www.youtube.com/watch?v=${youtubeId}`,
    "https://www.youtube.com/redirect?list=PLfake",
    "https://www.youtube.com/playlist?list=<iframe>",
    "javascript:alert(1)",
  ])("rejects untrusted or malformed URLs: %s", (url) => {
    expect(parseMusicLink(url)).toBeNull();
  });

  it("accepts recognized audio files without a media type", () => {
    expect(isLocalAudio({ name: "local.flac", type: "" })).toBe(true);
    expect(isLocalAudio({ name: "local.mp3", type: "text/html" })).toBe(false);
  });
});
