import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  trackVideoPlayComplete,
  trackVideoPlayStart,
  trackVideoScrollDepth,
} from "../lib/analytics";
import { VideoShort } from "../types/content";
import { SectionHeader } from "./SectionHeader";

interface VideoShortFeedProps {
  items?: VideoShort[];
  loading: boolean;
  error: string | null;
  updatedAt?: string;
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(value));
}

function ShortCard({ item }: { item: VideoShort }) {
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!isPlaying) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      trackVideoPlayComplete(item.id, item.title, 30);
    }, 30000);

    return () => window.clearTimeout(timer);
  }, [isPlaying, item.id, item.title]);

  return (
    <article className="card short-card">
      <div className="short-card-player">
        {isPlaying ? (
          <iframe
            src={item.embedUrl}
            title={item.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
          />
        ) : (
          <button
            className={`short-launcher ${item.isShort ? "short-launcher-portrait" : ""}`}
            onClick={() => {
              setIsPlaying(true);
              trackVideoPlayStart(item.id, item.title, item.relatedPath);
            }}
            type="button"
          >
            <span className="chip">{item.isShort ? "Shorts" : "Video"}</span>
            <strong>{item.title}</strong>
            <small>{item.source}</small>
            <span className="ghost-button short-launcher-button">Play inside XLB</span>
          </button>
        )}
      </div>
      <div className="short-card-meta">
        <div className="card-chip-row">
          <span className="chip chip-earth">{item.relatedLabel}</span>
          <span className="muted">{formatTimestamp(item.publishedAt)}</span>
        </div>
        <h3>{item.title}</h3>
        <p className="top-card-summary">{item.summary}</p>
        <div className="short-card-stats">
          <div className="metric-pill">
            <span>Freshness</span>
            <strong>{item.freshnessScore}</strong>
          </div>
          <div className="metric-pill">
            <span>Retention</span>
            <strong>{item.retentionScore}</strong>
          </div>
          <div className="metric-pill">
            <span>Source</span>
            <strong>{item.sourceCategory}</strong>
          </div>
        </div>
        <div className="event-related-list">
          <Link className="event-related-link" to={item.relatedPath}>
            {item.relatedLabel}
          </Link>
          <a className="event-related-link" href={item.url} rel="noreferrer" target="_blank">
            Watch on source
          </a>
        </div>
      </div>
    </article>
  );
}

export function VideoShortFeed({ items, loading, error, updatedAt }: VideoShortFeedProps) {
  const thresholds = useMemo(() => new Set<number>(), []);

  useEffect(() => {
    function onScroll() {
      const root = document.documentElement;
      const maxScroll = root.scrollHeight - window.innerHeight;
      if (maxScroll <= 0) {
        return;
      }

      const depth = Math.round((window.scrollY / maxScroll) * 100);
      [25, 50, 75, 100].forEach((threshold) => {
        if (depth >= threshold && !thresholds.has(threshold)) {
          thresholds.add(threshold);
          trackVideoScrollDepth(threshold);
        }
      });
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => window.removeEventListener("scroll", onScroll);
  }, [thresholds]);

  return (
    <section className="section-block" id="video-shorts">
      <SectionHeader
        eyebrow="Shorts"
        title="Watch inside XLB"
        description="Start the clip here, then keep moving into the related live or topic page without leaving the site."
        updatedAt={updatedAt}
      />
      <div className="short-feed-grid">
        {loading
          ? Array.from({ length: 4 }).map((_, index) => (
              <article className="card card-skeleton short-card" key={`short-${index}`}>
                <div className="skeleton-line skeleton-title" />
                <div className="skeleton-line skeleton-copy" />
              </article>
            ))
          : null}
        {error ? (
          <article className="card card-error">
            <p>Could not load the short-form feed.</p>
            <span>{error}</span>
          </article>
        ) : null}
        {items?.map((item) => (
          <ShortCard item={item} key={item.id} />
        ))}
      </div>
    </section>
  );
}
