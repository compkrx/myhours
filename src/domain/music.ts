type Provider = "Spotify" | "YouTube";
type SourceType = "playlist" | "album" | "track" | "video";

export interface MusicLink {
  provider: Provider;
  kind: SourceType;
  url: string;
  embedUrl: string;
}

const spotifyId = /^[A-Za-z0-9]{22}$/;
const youtubeVideoId = /^[A-Za-z0-9_-]{11}$/;
const youtubeListId = /^[A-Za-z0-9_-]{2,100}$/;
const youtubeHosts = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

function spotify(
  kind: string | undefined,
  id: string | undefined,
): MusicLink | null {
  if (kind !== "playlist" && kind !== "album" && kind !== "track") return null;
  if (!id || !spotifyId.test(id)) return null;
  return {
    provider: "Spotify",
    kind,
    url: `https://open.spotify.com/${kind}/${id}`,
    embedUrl: `https://open.spotify.com/embed/${kind}/${id}`,
  };
}

function youtube(url: URL): MusicLink | null {
  const path = url.pathname.split("/").filter(Boolean);
  const [page, pathId] = path;
  const shortLink = url.hostname === "youtu.be" && path.length === 1;
  const watchPage = page === "watch" && path.length === 1;
  const playlistPage = page === "playlist" && path.length === 1;
  const embedded = page === "embed" && path.length === 2;
  const shortVideo =
    (page === "shorts" || page === "live") && path.length === 2;

  if (!shortLink && !watchPage && !playlistPage && !embedded && !shortVideo)
    return null;

  const list = url.searchParams.get("list");
  if (list && youtubeListId.test(list)) {
    return {
      provider: "YouTube",
      kind: "playlist",
      url: `https://www.youtube.com/playlist?list=${list}`,
      embedUrl: `https://www.youtube-nocookie.com/embed/videoseries?list=${list}&playsinline=1`,
    };
  }

  const video = shortLink
    ? page
    : watchPage
      ? url.searchParams.get("v")
      : pathId;
  if (playlistPage || !video || !youtubeVideoId.test(video)) return null;
  return {
    provider: "YouTube",
    kind: "video",
    url: `https://www.youtube.com/watch?v=${video}`,
    embedUrl: `https://www.youtube-nocookie.com/embed/${video}?playsinline=1`,
  };
}

export function parseMusicLink(value: string): MusicLink | null {
  const input = value.trim();
  if (input.length > 2048) return null;
  const spotifyUri = /^spotify:(playlist|album|track):([A-Za-z0-9]+)$/.exec(
    input,
  );
  if (spotifyUri) return spotify(spotifyUri[1], spotifyUri[2]);

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port)
    return null;

  if (url.hostname === "open.spotify.com") {
    const path = url.pathname.split("/").filter(Boolean);
    while (
      path[0] === "embed" ||
      /^intl-[a-z]{2}(?:-[A-Z]{2})?$/.test(path[0] ?? "")
    ) {
      path.shift();
    }
    return path.length === 2 ? spotify(path[0], path[1]) : null;
  }

  return youtubeHosts.has(url.hostname) ? youtube(url) : null;
}

const supportedAudioExtensions =
  /\.(mp3|m4a|aac|wav|ogg|oga|opus|flac|webm|aiff?|caf)$/i;
const unsupportedFileTypes = new Set([
  "application/octet-stream",
  "application/ogg",
  "",
]);

export function isLocalAudio(file: Pick<File, "name" | "type">) {
  return (
    file.type.startsWith("audio/") ||
    (unsupportedFileTypes.has(file.type) &&
      supportedAudioExtensions.test(file.name))
  );
}

export function formatPlaybackTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}
