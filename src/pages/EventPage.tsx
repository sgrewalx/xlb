import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Seo } from "../components/Seo";
import { useContent } from "../hooks/useContent";
import { trackOutboundClick } from "../lib/analytics";
import { LiveEventsFeed, LiveEventScoreboard } from "../types/content";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(new Date(value));
}

function statusLabel(status: string) {
  return status === "watch"
    ? "Watch"
    : status === "monitoring"
      ? "Monitoring"
      : status === "upcoming"
        ? "Upcoming"
        : status === "live"
          ? "Live now"
      : "Ended";
}

function getCountdownLabel(value: string, status: string) {
  if (status === "watch" || status === "monitoring" || status === "live") {
    return "Happening now";
  }

  const diff = Date.parse(value) - Date.now();
  if (!Number.isFinite(diff)) {
    return "Schedule to be confirmed";
  }

  if (diff <= 0) {
    return "Starting soon";
  }

  const totalMinutes = Math.floor(diff / (1000 * 60));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

export function EventPage() {
  const { slug } = useParams();
  const feed = useContent<LiveEventsFeed>("/content/live/events.json");
  const scoreboard = useContent<LiveEventScoreboard>("/content/live/scoreboard.json");
  const feedItems = feed.data?.items ?? [];
  const item = feedItems.find((entry) => entry.slug === slug);
  const performance = scoreboard.data?.items.find((entry) => entry.slug === slug);
  const [countdownLabel, setCountdownLabel] = useState(() =>
    item ? getCountdownLabel(item.startsAt, item.status) : "",
  );

  useEffect(() => {
    if (!item) {
      return undefined;
    }

    const update = () => setCountdownLabel(getCountdownLabel(item.startsAt, item.status));
    update();
    const timer = window.setInterval(update, 60 * 1000);
    return () => window.clearInterval(timer);
  }, [item]);

  if (feed.loading) {
    return (
      <section className="section-block">
        <div className="card card-skeleton live-event-detail">
          <div className="skeleton-line skeleton-tag" />
          <div className="skeleton-line skeleton-title" />
          <div className="skeleton-line skeleton-copy" />
        </div>
      </section>
    );
  }

  if (feed.error || !item) {
    return (
      <>
        <Seo
          title="Event not found | XLB"
          description="The requested live event page is not available."
          path="/404"
        />
        <section className="static-hero">
          <p className="section-eyebrow">Event</p>
          <h1>Event not found</h1>
          <p>The event inventory may have changed or this page has not been generated yet.</p>
        </section>
      </>
    );
  }

  const relatedItems = feedItems
    .filter((entry) => entry.slug !== item.slug && entry.category === item.category)
    .slice(0, 2);

  return (
    <>
      <Seo
        title={`${item.title} | XLB`}
        description={item.summary}
        path={`/events/${item.slug}`}
      />
      <section className="event-hero">
        <div className="event-hero-main">
          <div className="card-chip-row">
            <span className={`chip chip-${item.category}`}>{item.category}</span>
            <span className={`live-status live-status-${item.status}`}>
              {statusLabel(item.status)}
            </span>
          </div>
          <h1>{item.title}</h1>
          <p className="event-summary">{item.summary}</p>
          <div className="event-signal-bar">
            <div className="signal-panel signal-panel-accent">
              <span>Countdown</span>
              <strong>{countdownLabel}</strong>
            </div>
            <div className="signal-panel">
              <span>Source</span>
              <strong>{item.sourceName}</strong>
            </div>
            <div className="signal-panel">
              <span>Schedule</span>
              <strong>{formatDate(item.startsAt)}</strong>
            </div>
            {performance ? (
              <div className="signal-panel">
                <span>Trust signal</span>
                <strong>{performance.sourceStability}</strong>
              </div>
            ) : null}
          </div>
          <div className="event-actions">
            <a
              className="ghost-button"
              href={item.watchUrl}
              rel="noreferrer"
              target="_blank"
              onClick={() =>
                trackOutboundClick({
                  destination: item.watchUrl,
                  label: item.title,
                  category: "watch_source",
                  context: "event_page_primary",
                })
              }
            >
              Watch source
            </a>
            <a
              className="ghost-button button-secondary"
              href={item.sourceUrl}
              rel="noreferrer"
              target="_blank"
              onClick={() =>
                trackOutboundClick({
                  destination: item.sourceUrl,
                  label: item.title,
                  category: "open_source",
                  context: "event_page_secondary",
                })
              }
            >
              Open source
            </a>
          </div>
        </div>
        <aside className="card event-facts">
          <p className="section-eyebrow">Event facts</p>
          <div className="event-fact-grid">
            <div className="metric-pill">
              <span>Topic</span>
              <strong>{item.topic}</strong>
            </div>
            <div className="metric-pill">
              <span>Starts</span>
              <strong>{formatDate(item.startsAt)}</strong>
            </div>
            <div className="metric-pill">
              <span>Source</span>
              <strong>{item.sourceName}</strong>
            </div>
            <div className="metric-pill">
              <span>Coverage mode</span>
              <strong>{item.coverageMode.replace("_", " ")}</strong>
            </div>
            {performance ? (
              <>
                <div className="metric-pill">
                  <span>Source trust</span>
                  <strong>{performance.sourceStability}</strong>
                </div>
                <div className="metric-pill">
                  <span>Timing</span>
                  <strong>{performance.recencyBand.replaceAll("-", " ")}</strong>
                </div>
                <div className="metric-pill">
                  <span>Category pulse</span>
                  <strong>{performance.categoryPageviews}</strong>
                </div>
                <div className="metric-pill">
                  <span>Event page views</span>
                  <strong>{performance.pageviews}</strong>
                </div>
              </>
            ) : null}
          </div>
        </aside>
      </section>

      <section className="section-block">
        <div className="event-columns">
          <article className="card event-copy-card">
            <p className="section-eyebrow">Why it matters</p>
            <h2>Automation-ready event page</h2>
            <p>
              {item.whyItMatters ??
                "This record is intended to grow into a richer event page with context, linked sources, and measurable watch-click behavior."}
            </p>
            <p>
              Each page is built to stay clear and useful even as the event changes, with room for
              stronger context, source links, and related follow-up coverage over time.
            </p>
          </article>

          <article className="card event-copy-card">
            <p className="section-eyebrow">Watch Flow</p>
            <h2>How to follow this event</h2>
            <div className="sticky-list">
              <div className="sticky-row">
                <div>
                  <strong>Check the source window</strong>
                  <p>{item.sourceName} is the primary place to confirm timing and status updates.</p>
                </div>
              </div>
              <div className="sticky-row">
                <div>
                  <strong>Follow the topic page</strong>
                  <p>Related pages collect the broader story so you can keep moving when this event changes.</p>
                </div>
              </div>
              <div className="sticky-row">
                <div>
                  <strong>Come back for the next moment</strong>
                  <p>Event pages are paired with other live items in the same category and topic.</p>
                </div>
              </div>
            </div>
          </article>

          <article className="card event-copy-card">
            <p className="section-eyebrow">Related</p>
            <h2>Keep exploring</h2>
            <div className="event-related-list">
              <Link className="event-related-link" to={`/live/${item.category}`}>
                Browse {item.category} events
              </Link>
              <Link className="event-related-link" to={`/topics/${item.topic}`}>
                Open {item.topic} topic
              </Link>
              <Link className="event-related-link" to="/live">
                See the full live inventory
              </Link>
              {relatedItems.map((relatedItem) => (
                <Link className="event-related-link" key={relatedItem.id} to={`/events/${relatedItem.slug}`}>
                  {relatedItem.title}
                </Link>
              ))}
            </div>
          </article>
        </div>
      </section>
    </>
  );
}
