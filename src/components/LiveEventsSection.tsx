import { Link } from "react-router-dom";
import { trackOutboundClick } from "../lib/analytics";
import { LiveEventItem, LiveEventScore } from "../types/content";
import { SectionHeader } from "./SectionHeader";

interface LiveEventsSectionProps {
  eyebrow?: string;
  title?: string;
  description?: string;
  updatedAt?: string;
  loading: boolean;
  error: string | null;
  items?: LiveEventItem[];
  scores?: LiveEventScore[];
  showPerformance?: boolean;
  categoryFilter?: "space" | "earth";
  limit?: number;
}

function getStatusLabel(status: LiveEventItem["status"]) {
  switch (status) {
    case "live":
      return "Live now";
    case "upcoming":
      return "Upcoming";
    case "ended":
      return "Ended";
    case "watch":
      return "Watch";
    case "monitoring":
      return "Monitoring";
    default:
      return status;
  }
}

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

function getScore(scores: LiveEventScore[] | undefined, slug: string) {
  return scores?.find((item) => item.slug === slug) ?? null;
}

export function LiveEventsSection({
  eyebrow = "Live",
  title = "Public-interest events",
  description = "Source-backed events designed for repeat visits, watch-clicks, and eventually topic pages.",
  updatedAt,
  loading,
  error,
  items,
  scores,
  showPerformance = false,
  categoryFilter,
  limit,
}: LiveEventsSectionProps) {
  const rankedItems = [...(items ?? [])]
    .filter((item) => (categoryFilter ? item.category === categoryFilter : true))
    .sort((left, right) => (right.heroPriority ?? 0) - (left.heroPriority ?? 0));

  const visibleItems =
    typeof limit === "number" ? rankedItems.slice(0, limit) : rankedItems;

  return (
    <section className="section-block" id="live-events">
      <SectionHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        updatedAt={updatedAt}
      />
      <div className="live-events-grid">
        {loading
          ? Array.from({ length: limit ?? 3 }).map((_, index) => (
              <article className="card card-skeleton live-event-card" key={`live-event-${index}`}>
                <div className="skeleton-line skeleton-tag" />
                <div className="skeleton-line skeleton-title" />
                <div className="skeleton-line skeleton-copy" />
              </article>
            ))
          : null}

        {error ? (
          <article className="card card-error">
            <p>Could not load live events.</p>
            <span>{error}</span>
          </article>
        ) : null}

        {visibleItems.map((item) => (
          <article className="card live-event-card" key={item.id}>
            {showPerformance && getScore(scores, item.slug) ? (
              <div className="live-event-performance">
                <span className={`performance-pill performance-pill-${getScore(scores, item.slug)?.recommendation}`}>
                  {getScore(scores, item.slug)?.recommendation}
                </span>
                <span className="muted">
                  Score {getScore(scores, item.slug)?.score} · {getScore(scores, item.slug)?.sourceStability}
                </span>
              </div>
            ) : null}
            <div className="live-event-card-top">
              <div className="card-chip-row">
                <span className={`chip chip-${item.category}`}>{item.category}</span>
                <span className={`live-status live-status-${item.status}`}>
                  {getStatusLabel(item.status)}
                </span>
              </div>
              <p className="live-event-topic">{item.topic}</p>
            </div>

            <div className="live-event-body">
              <h3>{item.title}</h3>
              <p>{item.featuredReason ?? item.summary}</p>
            </div>

            <div className="live-event-meta">
              <div>
                <span className="muted">Starts</span>
                <strong>{formatDate(item.startsAt)}</strong>
              </div>
              <div>
                <span className="muted">Source</span>
                <strong>{item.sourceName}</strong>
              </div>
            </div>

            <div className="live-event-actions">
              <Link className="ghost-button" to={`/events/${item.slug}`}>
                Open event
              </Link>
              <a
                className="ghost-button button-secondary"
                href={item.watchUrl}
                rel="noreferrer"
                target="_blank"
                onClick={() =>
                  trackOutboundClick({
                    destination: item.watchUrl,
                    label: item.title,
                    category: "watch_source",
                    context: "live_event_card",
                  })
                }
              >
                Watch source
              </a>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
