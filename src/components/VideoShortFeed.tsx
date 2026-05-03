import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { trackVideoPlayComplete, trackVideoPlayStart } from "../lib/analytics";
import { VideoShort } from "../types/content";

interface VideoShortFeedProps {
  items?: VideoShort[];
  loading: boolean;
  error: string | null;
  updatedAt?: string;
}

function buildEmbedSrc(embedUrl: string) {
  const separator = embedUrl.includes("?") ? "&" : "?";
  const origin = typeof window === "undefined" ? "" : `&origin=${encodeURIComponent(window.location.origin)}`;

  return `${embedUrl}${separator}autoplay=1&mute=1&playsinline=1&enablejsapi=1${origin}`;
}

export function VideoShortFeed({ items, loading, error }: VideoShortFeedProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeItem = items?.[activeIndex] ?? null;
  const total = items?.length ?? 0;

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
    function onKeyDown(event: KeyboardEvent) {
      if (!items?.length) {
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((current) => (current + 1) % items.length);
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((current) => (current - 1 + items.length) % items.length);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [items]);

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
    <section className="section-block" id="video-shorts">
      <div className="short-viewer-shell">
        <article className="card short-viewer-card">
          <div className="short-viewer-frame">
            <iframe
              src={buildEmbedSrc(activeItem.embedUrl)}
              title={activeItem.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="eager"
            />
          </div>
          <div className="short-viewer-overlay">
            <div className="card-chip-row">
              <span className="chip chip-space">{activeItem.isShort ? "Shorts" : "Video"}</span>
              <span className="muted">
                {activeIndex + 1} / {total}
              </span>
            </div>
            <div className="short-viewer-copy">
              <h2>{activeItem.title}</h2>
              <p>{activeItem.summary}</p>
              <div className="event-related-list">
                <Link className="event-related-link" to={activeItem.relatedPath}>
                  {activeItem.relatedLabel}
                </Link>
                <a className="event-related-link" href={activeItem.url} rel="noreferrer" target="_blank">
                  Open source
                </a>
              </div>
            </div>
          </div>
        </article>

        <aside className="short-viewer-rail">
          <button
            aria-label="Previous video"
            className="short-nav-button"
            onClick={() => setActiveIndex((current) => (current - 1 + total) % total)}
            type="button"
          >
            ↑
          </button>
          <button
            aria-label="Next video"
            className="short-nav-button"
            onClick={() => setActiveIndex((current) => (current + 1) % total)}
            type="button"
          >
            ↓
          </button>
        </aside>
      </div>
    </section>
  );
}
