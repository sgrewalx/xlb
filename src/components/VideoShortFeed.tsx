import { useCallback, useEffect, useRef, useState } from "react";
import { trackVideoPlayComplete, trackVideoPlayStart } from "../lib/analytics";
import { VideoShort } from "../types/content";

interface VideoShortFeedProps {
  items?: VideoShort[];
  loading: boolean;
  error: string | null;
}

interface YouTubePlayer {
  destroy(): void;
  getVolume(): number;
  isMuted(): boolean;
  mute(): void;
  playVideo(): void;
  setVolume(volume: number): void;
  unMute(): void;
}

interface YouTubePlayerEvent {
  target: YouTubePlayer;
}

interface YouTubeApi {
  Player: new (
    element: HTMLIFrameElement,
    options: { events: { onReady: (event: YouTubePlayerEvent) => void } },
  ) => YouTubePlayer;
}

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youtubeApiPromise: Promise<YouTubeApi> | null = null;

function loadYouTubeApi() {
  if (window.YT?.Player) {
    return Promise.resolve(window.YT);
  }
  if (youtubeApiPromise) {
    return youtubeApiPromise;
  }

  youtubeApiPromise = new Promise<YouTubeApi>((resolve, reject) => {
    const previousReadyHandler = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousReadyHandler?.();
      if (window.YT?.Player) {
        resolve(window.YT);
      } else {
        reject(new Error("YouTube IFrame API loaded without a player constructor."));
      }
    };

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]',
    );
    if (existingScript) {
      existingScript.addEventListener("error", () => reject(new Error("Could not load YouTube IFrame API.")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.addEventListener("error", () => reject(new Error("Could not load YouTube IFrame API.")), {
      once: true,
    });
    document.head.appendChild(script);
  });

  return youtubeApiPromise;
}

function buildEmbedSrc(embedUrl: string, muted: boolean) {
  const separator = embedUrl.includes("?") ? "&" : "?";
  const origin = typeof window === "undefined" ? "" : `&origin=${encodeURIComponent(window.location.origin)}`;

  return `${embedUrl}${separator}autoplay=1&mute=${muted ? 1 : 0}&playsinline=1&enablejsapi=1${origin}`;
}

export function VideoShortFeed({ items, loading, error }: VideoShortFeedProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const mutedPreferenceRef = useRef(true);
  const volumePreferenceRef = useRef(100);
  const activeItem = items?.[activeIndex] ?? null;
  const total = items?.length ?? 0;

  const captureAudioPreference = useCallback(() => {
    const player = playerRef.current;
    if (!player) {
      return;
    }

    try {
      mutedPreferenceRef.current = player.isMuted();
      if (!mutedPreferenceRef.current) {
        volumePreferenceRef.current = player.getVolume();
      }
    } catch {
      // The outgoing YouTube iframe may already be unavailable during teardown.
    }
  }, []);

  const moveVideo = useCallback((offset: number) => {
    if (!total) {
      return;
    }
    captureAudioPreference();
    setActiveIndex((current) => (current + offset + total) % total);
  }, [captureAudioPreference, total]);

  useEffect(() => {
    if (!activeItem) {
      return undefined;
    }

    trackVideoPlayStart(activeItem.id, activeItem.title, activeItem.relatedPath);
    const timer = window.setTimeout(() => {
      trackVideoPlayComplete(activeItem.id, activeItem.title, 30);
    }, 30000);

    return () => window.clearTimeout(timer);
  }, [activeItem]);

  useEffect(() => {
    if (!activeItem || !iframeRef.current) {
      return undefined;
    }

    let cancelled = false;
    let player: YouTubePlayer | null = null;

    loadYouTubeApi()
      .then((youtube) => {
        if (cancelled || !iframeRef.current) {
          return;
        }

        player = new youtube.Player(iframeRef.current, {
          events: {
            onReady: ({ target }) => {
              if (cancelled) {
                return;
              }

              playerRef.current = target;
              if (mutedPreferenceRef.current) {
                target.mute();
              } else {
                target.setVolume(volumePreferenceRef.current);
                target.unMute();
                target.playVideo();
              }
            },
          },
        });
      })
      .catch(() => {
        // The embed remains usable with its native controls if the API is unavailable.
      });

    return () => {
      cancelled = true;
      captureAudioPreference();
      if (playerRef.current === player) {
        playerRef.current = null;
      }
      player?.destroy();
    };
  }, [activeItem, captureAudioPreference]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!items?.length) {
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        moveVideo(1);
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        moveVideo(-1);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [items, moveVideo]);

  if (loading) {
    return (
      <section className="section-block" id="video-shorts">
        <article className="card card-skeleton short-viewer-card">
          <div className="skeleton-line skeleton-title" />
          <div className="skeleton-line skeleton-copy" />
        </article>
      </section>
    );
  }

  if (error || !activeItem) {
    return (
      <section className="section-block" id="video-shorts">
        <article className="card card-error">
          <p>Could not load the video feed.</p>
          <span>{error ?? "No videos available."}</span>
        </article>
      </section>
    );
  }

  return (
    <section className="section-block video-reel-section" id="video-shorts">
      <div className="short-viewer-shell">
        <article className="short-viewer-card">
          <div className="short-viewer-frame">
            <iframe
              key={activeItem.id}
              ref={iframeRef}
              src={buildEmbedSrc(activeItem.embedUrl, mutedPreferenceRef.current)}
              title={activeItem.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="eager"
            />
            <div className="short-viewer-frame-gradient" />
            <div className="short-viewer-count">
              {activeIndex + 1} / {total}
            </div>
            <div className="short-viewer-overlay">
              <div className="card-chip-row">
                <span className="chip chip-space">{activeItem.isShort ? "Shorts" : "Video"}</span>
                <span className="chip chip-earth">{activeItem.relatedLabel}</span>
              </div>
              <div className="short-viewer-copy">
                <h2>{activeItem.title}</h2>
                <p>{activeItem.summary}</p>
              </div>
            </div>
          </div>
        </article>

        <aside className="short-viewer-rail">
          <button
            aria-label="Previous video"
            className="short-nav-button"
            onClick={() => moveVideo(-1)}
            type="button"
          >
            ↑
          </button>
          <button
            aria-label="Next video"
            className="short-nav-button"
            onClick={() => moveVideo(1)}
            type="button"
          >
            ↓
          </button>
        </aside>
      </div>
    </section>
  );
}
