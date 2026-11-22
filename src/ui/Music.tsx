import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Bookmark,
  ExternalLink,
  FileAudio2,
  Headphones,
  ListMusic,
  Music2,
  Pause,
  Pencil,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useApp } from "./context";
import { Button, IconButton, Section } from "./components";
import { str, titleOf } from "../domain/model";
import {
  formatPlaybackTime,
  isLocalAudio,
  parseMusicLink,
  type MusicLink,
} from "../domain/music";
import "./music.css";

interface LocalTrack {
  id: string;
  title: string;
  objectUrl: string;
  fingerprint: string;
}

interface ActiveEmbed {
  link: MusicLink;
  title: string;
}

const maxQueueLength = 100;
const maxAudioFileSize = 250 * 1024 * 1024;

export default function Music({ active }: { active: boolean }) {
  const { records, repo, notify, edit, navigate } = useApp();
  const [link, setLink] = useState("");
  const [title, setTitle] = useState("");
  const [linkError, setLinkError] = useState("");
  const [saving, setSaving] = useState(false);
  const [embed, setEmbed] = useState<ActiveEmbed | null>(null);
  const [queue, setQueue] = useState<LocalTrack[]>([]);
  const [trackId, setTrackId] = useState<string>();
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [audioError, setAudioError] = useState("");
  const [pageVisible, setPageVisible] = useState(() => !document.hidden);
  const audio = useRef<HTMLAudioElement>(null);
  const objectUrls = useRef(new Set<string>());
  const sourceRevision = useRef(0);
  const currentTrack = queue.find((track) => track.id === trackId);
  const currentIndex = queue.findIndex((track) => track.id === trackId);
  const savedLinks = records.filter((record) => record.kind === "musicSource");
  const showEmbed = Boolean(
    embed && (embed.link.provider !== "YouTube" || (active && pageVisible)),
  );
  const showPlayer = showEmbed || Boolean(currentTrack && !embed);

  useEffect(() => {
    const urls = objectUrls.current;
    function updateVisibility() {
      setPageVisible(!document.hidden);
    }
    document.addEventListener("visibilitychange", updateVisibility);
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
      urls.clear();
      document.removeEventListener("visibilitychange", updateVisibility);
    };
  }, []);

  function removeObjectUrl(url: string) {
    URL.revokeObjectURL(url);
    objectUrls.current.delete(url);
  }

  function resetAudio() {
    sourceRevision.current += 1;
    const element = audio.current;
    if (element) {
      element.pause();
      element.removeAttribute("src");
      element.load();
    }
    setPlaying(false);
    setPosition(0);
    setDuration(0);
  }

  async function playAudio() {
    const element = audio.current;
    const revision = sourceRevision.current;
    if (!element) return;
    try {
      await element.play();
    } catch (error) {
      if (revision !== sourceRevision.current) return;
      if (error instanceof DOMException && error.name === "AbortError") return;
      setAudioError(
        "This file could not play. Try another file or use the play button again.",
      );
    }
  }

  function selectTrack(track: LocalTrack, start: boolean) {
    setEmbed(null);
    setAudioError("");
    const element = audio.current;
    if (!element) return;
    if (element.getAttribute("src") !== track.objectUrl) {
      resetAudio();
      element.src = track.objectUrl;
      setTrackId(track.id);
    }
    if (start) void playAudio();
  }

  function addFiles(files: File[]) {
    const fingerprints = new Set(queue.map((track) => track.fingerprint));
    const added: LocalTrack[] = [];
    let skipped = 0;
    for (const file of files) {
      const fingerprint = JSON.stringify([
        file.name,
        file.lastModified,
        file.size,
      ]);
      if (
        fingerprints.has(fingerprint) ||
        !isLocalAudio(file) ||
        file.size === 0 ||
        file.size > maxAudioFileSize ||
        queue.length + added.length >= maxQueueLength
      ) {
        skipped += 1;
        continue;
      }
      const objectUrl = URL.createObjectURL(file);
      objectUrls.current.add(objectUrl);
      added.push({
        id: crypto.randomUUID(),
        title: file.name,
        objectUrl,
        fingerprint,
      });
      fingerprints.add(fingerprint);
    }
    if (added.length) {
      setQueue((existing) => [...existing, ...added]);
      if (!currentTrack && !embed) selectTrack(added[0], false);
    }
    if (skipped) {
      notify(
        `${skipped} ${skipped === 1 ? "file skipped" : "files skipped"}. Check file type, size limits, and duplicates.`,
      );
    }
  }

  function removeTrack(track: LocalTrack) {
    const next = queue.filter((item) => item.id !== track.id);
    setQueue(next);
    if (track.id === trackId) {
      resetAudio();
      setAudioError("");
      setTrackId(undefined);
      const replacement = next[Math.min(currentIndex, next.length - 1)];
      if (replacement && !embed) selectTrack(replacement, false);
    }
    removeObjectUrl(track.objectUrl);
  }

  function clearQueue() {
    resetAudio();
    for (const track of queue) removeObjectUrl(track.objectUrl);
    setTrackId(undefined);
    setQueue([]);
    setAudioError("");
  }

  function togglePlayback() {
    const element = audio.current;
    if (!element) return;
    if (element.paused) {
      setAudioError("");
      void playAudio();
    } else {
      element.pause();
    }
  }

  function selectAdjacent(offset: number) {
    const track = queue[currentIndex + offset];
    if (track) selectTrack(track, playing);
  }

  function loadEmbed(selectedLink: MusicLink, label?: string) {
    if (!navigator.onLine) {
      setLinkError(
        "Streaming requires a connection. Local audio is available offline.",
      );
      return;
    }
    audio.current?.pause();
    setEmbed({
      link: selectedLink,
      title: label || `${selectedLink.provider} ${selectedLink.kind}`,
    });
    setLinkError("");
  }

  function handleLoad(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selectedLink = parseMusicLink(link);
    if (!selectedLink) {
      setLinkError(
        "Paste a supported Spotify or YouTube link. Spotify short links need to be expanded first.",
      );
      return;
    }
    loadEmbed(selectedLink, title.trim());
  }

  async function saveLink() {
    const selectedLink = parseMusicLink(link);
    if (!selectedLink) {
      setLinkError("Paste a supported link before saving it.");
      return;
    }
    if (
      savedLinks.some(
        (record) =>
          parseMusicLink(str(record, "url"))?.url === selectedLink.url,
      )
    ) {
      setLinkError("This link is already in your library.");
      return;
    }
    setSaving(true);
    setLinkError("");
    try {
      await repo.save("musicSource", {
        title: title.trim() || `${selectedLink.provider} ${selectedLink.kind}`,
        url: selectedLink.url,
      });
      notify("Link saved to your music library.");
    } catch (error) {
      setLinkError(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  }

  function updateDuration() {
    const element = audio.current;
    setDuration(
      element && Number.isFinite(element.duration) ? element.duration : 0,
    );
  }

  return (
    <div className={active ? "music-page" : "music-offpage"}>
      <audio
        ref={audio}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(event) => setPosition(event.currentTarget.currentTime)}
        onLoadedMetadata={updateDuration}
        onDurationChange={updateDuration}
        onError={() => {
          if (audio.current?.getAttribute("src")) {
            setPlaying(false);
            setAudioError("Your browser could not decode this audio file.");
          }
        }}
        onEnded={() => {
          const next = queue[currentIndex + 1];
          if (next) selectTrack(next, true);
          else setPlaying(false);
        }}
      />

      {active ? (
        <header className="page-heading music-heading">
          <div>
            <h1>Music</h1>
            <p>
              Play your own files or open a playlist from Spotify or YouTube.
            </p>
          </div>
          <Headphones size={28} aria-hidden="true" />
        </header>
      ) : null}

      {showPlayer ? (
        <section
          className={`music-player ${active ? "" : "music-player-dock"}`}
          aria-label="Music player"
        >
          {showEmbed && embed ? (
            <>
              <div className="music-player-title">
                <div className="music-player-icon">
                  <ListMusic size={20} />
                </div>
                <span>
                  <strong>{embed.title}</strong>
                  <small>{embed.link.provider} player</small>
                </span>
                {!active ? (
                  <IconButton
                    label="Open Music page"
                    onClick={() => navigate("music")}
                  >
                    <ExternalLink size={15} />
                  </IconButton>
                ) : null}
                <IconButton
                  label="Close embedded player"
                  onClick={() => setEmbed(null)}
                >
                  <X size={17} />
                </IconButton>
              </div>
              <iframe
                key={embed.link.embedUrl}
                src={embed.link.embedUrl}
                className={`music-embed ${embed.link.provider === "YouTube" ? "music-embed-video" : ""}`}
                title={`${embed.link.provider} ${embed.link.kind} player`}
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
              {active ? (
                <a
                  className="text-button music-provider-link"
                  href={embed.link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open on {embed.link.provider} <ExternalLink size={13} />
                </a>
              ) : null}
            </>
          ) : currentTrack ? (
            <>
              <div className="music-player-title">
                <div className="music-player-icon">
                  <FileAudio2 size={20} />
                </div>
                <span>
                  <strong>{currentTrack.title}</strong>
                  <small>
                    Local audio · {currentIndex + 1} of {queue.length}
                  </small>
                </span>
                {!active ? (
                  <>
                    <IconButton
                      label={playing ? "Pause music" : "Play music"}
                      onClick={togglePlayback}
                    >
                      {playing ? <Pause size={16} /> : <Play size={16} />}
                    </IconButton>
                    <IconButton
                      label="Open Music page"
                      onClick={() => navigate("music")}
                    >
                      <ExternalLink size={15} />
                    </IconButton>
                    <IconButton
                      label="Close local player"
                      onClick={() => {
                        resetAudio();
                        setTrackId(undefined);
                      }}
                    >
                      <X size={17} />
                    </IconButton>
                  </>
                ) : null}
              </div>
              {active ? (
                <>
                  <div className="music-seek">
                    <span>{formatPlaybackTime(position)}</span>
                    <input
                      type="range"
                      aria-label="Playback position"
                      aria-valuetext={`${formatPlaybackTime(position)} of ${formatPlaybackTime(duration)}`}
                      min={0}
                      max={duration || 1}
                      step={0.1}
                      value={Math.min(position, duration)}
                      disabled={!duration}
                      onChange={(event) => {
                        if (audio.current)
                          audio.current.currentTime = Number(
                            event.target.value,
                          );
                        setPosition(Number(event.target.value));
                      }}
                    />
                    <span>{formatPlaybackTime(duration)}</span>
                  </div>
                  <div className="music-player-controls">
                    <IconButton
                      label="Previous track"
                      disabled={currentIndex <= 0}
                      onClick={() => selectAdjacent(-1)}
                    >
                      <SkipBack size={18} />
                    </IconButton>
                    <Button
                      className="music-play-button"
                      onClick={togglePlayback}
                    >
                      {playing ? <Pause size={17} /> : <Play size={17} />}
                      {playing ? "Pause" : "Play"}
                    </Button>
                    <IconButton
                      label="Next track"
                      disabled={currentIndex >= queue.length - 1}
                      onClick={() => selectAdjacent(1)}
                    >
                      <SkipForward size={18} />
                    </IconButton>
                    <div className="music-volume">
                      <IconButton
                        label={muted ? "Unmute" : "Mute"}
                        onClick={() => {
                          const element = audio.current;
                          if (element) element.muted = !element.muted;
                          setMuted(!muted);
                        }}
                      >
                        {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
                      </IconButton>
                      <input
                        type="range"
                        aria-label="Volume"
                        aria-valuetext={`${Math.round((muted ? 0 : volume) * 100)} percent`}
                        min={0}
                        max={1}
                        step={0.01}
                        value={muted ? 0 : volume}
                        onChange={(event) => {
                          const nextVolume = Number(event.target.value);
                          const element = audio.current;
                          if (element) {
                            element.volume = nextVolume;
                            element.muted = false;
                          }
                          setVolume(nextVolume);
                          setMuted(false);
                        }}
                      />
                    </div>
                  </div>
                </>
              ) : null}
            </>
          ) : null}
          {audioError && !embed ? (
            <p className="error" role="alert">
              {audioError}
            </p>
          ) : null}
        </section>
      ) : null}

      {active ? (
        <div className="music-workspace">
          <Section title="Play a link" action={<Music2 size={18} />}>
            <form className="music-link-form" onSubmit={handleLoad}>
              <label htmlFor="music-link">Spotify or YouTube link</label>
              <input
                id="music-link"
                type="text"
                inputMode="url"
                autoCapitalize="none"
                autoComplete="off"
                spellCheck={false}
                placeholder="https://…"
                value={link}
                maxLength={2048}
                onChange={(event) => {
                  setLink(event.target.value);
                  setLinkError("");
                }}
              />
              <label htmlFor="music-title">
                Label <span className="muted">(optional)</span>
              </label>
              <input
                id="music-title"
                type="text"
                placeholder="Study playlist"
                value={title}
                maxLength={120}
                onChange={(event) => setTitle(event.target.value)}
              />
              <div className="music-button-row">
                <Button type="submit" disabled={!link.trim()}>
                  <Play size={16} /> Load player
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void saveLink()}
                  disabled={!link.trim() || saving}
                >
                  <Bookmark size={16} /> Save link
                </Button>
              </div>
              {linkError ? (
                <p className="error" role="alert">
                  {linkError}
                </p>
              ) : null}
            </form>
            <p className="muted music-explanation">
              The provider lists available tracks in its player. Playback and
              sign-in depend on the provider, your region, and the playlist.
              YouTube video plays on this page.
            </p>
            <p className="muted music-explanation">
              Loading a player connects to Spotify or YouTube. Saved links stay
              unloaded until you select one.
            </p>
          </Section>

          <Section
            title="Local audio"
            subtitle="Your files stay on this device. The queue lasts until you close or reload the app."
            action={<FileAudio2 size={18} />}
          >
            <div className="music-button-row">
              <label className="button secondary music-file-button">
                <FileAudio2 size={16} /> Add audio files
                <input
                  aria-label="Add audio files"
                  type="file"
                  multiple
                  accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.oga,.opus,.flac,.webm,.aif,.aiff,.caf"
                  onChange={(event) => {
                    addFiles(Array.from(event.target.files ?? []));
                    event.target.value = "";
                  }}
                />
              </label>
              {queue.length ? (
                <Button type="button" variant="secondary" onClick={clearQueue}>
                  Clear queue
                </Button>
              ) : null}
            </div>
            {queue.length ? (
              <ul className="music-list" aria-label="Local audio queue">
                {queue.map((track) => (
                  <li key={track.id} className="music-list-row">
                    <button
                      type="button"
                      className="music-row-control"
                      aria-label={`Play ${track.title}`}
                      onClick={() => selectTrack(track, true)}
                    >
                      {track.id === trackId && playing && !embed ? (
                        <Volume2 size={16} />
                      ) : (
                        <Play size={16} />
                      )}
                      <span>{track.title}</span>
                    </button>
                    <IconButton
                      label={`Remove ${track.title} from queue`}
                      onClick={() => removeTrack(track)}
                    >
                      <X size={17} />
                    </IconButton>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted music-explanation">
                Add MP3, WAV, or another format your browser supports. You can
                select up to 100 files, each up to 250 MB.
              </p>
            )}
          </Section>

          <Section
            title="Saved links"
            subtitle="Keep your playlists and tracks here. Open the original to manage the playlist."
            action={<Bookmark size={18} />}
          >
            {savedLinks.length ? (
              <ul className="music-list" aria-label="Saved music links">
                {savedLinks.map((record) => {
                  const savedLink = parseMusicLink(str(record, "url"));
                  return (
                    <li className="music-list-row" key={record.id}>
                      <button
                        type="button"
                        className="music-row-control"
                        disabled={!savedLink}
                        onClick={() => {
                          if (savedLink) loadEmbed(savedLink, titleOf(record));
                        }}
                        aria-label={`Load ${titleOf(record)}`}
                      >
                        <Play size={16} />
                        <span>
                          {titleOf(record)}
                          <small>
                            {savedLink
                              ? `${savedLink.provider} ${savedLink.kind}`
                              : "Unsupported link"}
                          </small>
                        </span>
                      </button>
                      {savedLink ? (
                        <a
                          className="icon-button"
                          aria-label={`Open ${titleOf(record)} on ${savedLink.provider}`}
                          title={`Open on ${savedLink.provider}`}
                          href={savedLink.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink size={16} />
                        </a>
                      ) : null}
                      <IconButton
                        label={`Edit ${titleOf(record)}`}
                        onClick={() => edit("musicSource", record)}
                      >
                        <Pencil size={16} />
                      </IconButton>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="muted music-explanation">
                Save your first link above.
              </p>
            )}
          </Section>
        </div>
      ) : null}
    </div>
  );
}
