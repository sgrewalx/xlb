import { FeedItem } from "../types/content";
import { SectionHeader } from "./SectionHeader";

interface TopListSectionProps {
  id: string;
  eyebrow: string;
  title?: string;
  description?: string;
  headerTags?: string[];
  hideItemTags?: boolean;
  visualMode?: "sports";
  expanded?: boolean;
  loading: boolean;
  error: string | null;
  updatedAt?: string;
  items?: FeedItem[];
}

const SPORTS_VISUALS: Record<string, { image: string; label: string; className: string }> = {
  football: {
    image: "/media/sports/football.svg",
    label: "Football",
    className: "top-card-media-football",
  },
  basketball: {
    image: "/media/sports/basketball.svg",
    label: "Basketball",
    className: "top-card-media-basketball",
  },
  tennis: {
    image: "/media/sports/tennis.svg",
    label: "Tennis",
    className: "top-card-media-tennis",
  },
  cricket: {
    image: "/media/sports/football.svg",
    label: "Cricket",
    className: "top-card-media-cricket",
  },
  running: {
    image: "/media/sports/tennis.svg",
    label: "Running",
    className: "top-card-media-running",
  },
};

export function TopListSection({
  id,
  eyebrow,
  title,
  description,
  headerTags,
  hideItemTags = false,
  visualMode,
  expanded = false,
  loading,
  error,
  updatedAt,
  items,
}: TopListSectionProps) {
  return (
    <section id={id} className="section-block">
      {headerTags?.length ? (
        <div className="games-header top-list-header">
          <p className="section-eyebrow">{eyebrow}</p>
          <div className="top-list-tags" aria-label={`${eyebrow} categories`}>
            {headerTags.map((tag) => (
              <p className="games-mode-label" key={tag}>
                {tag}
              </p>
            ))}
          </div>
        </div>
      ) : (
        <SectionHeader
          eyebrow={eyebrow}
          title={title}
          description={description}
        />
      )}
      <div className={`top-grid ${expanded ? "top-grid-expanded" : ""}`}>
        {loading
          ? Array.from({ length: expanded ? 6 : 3 }).map((_, index) => (
              <article className="card card-skeleton" key={`${id}-${index}`}>
                <div className="skeleton-line skeleton-tag" />
                <div className="skeleton-line skeleton-title" />
                <div className="skeleton-line skeleton-copy" />
              </article>
            ))
          : null}

        {error ? (
          <article className="card card-error">
            <p>Could not load this section.</p>
            <span>{error}</span>
          </article>
        ) : null}

        {items?.map((item, index) => (
          <a
            className="card top-card"
            key={item.id}
            href={item.url}
            target="_blank"
            rel="noreferrer"
          >
            {visualMode === "sports" ? (
              <div
                className={`top-card-media ${
                  SPORTS_VISUALS[item.tag.toLowerCase()]?.className ?? ""
                }`}
              >
                <img
                  src={
                    SPORTS_VISUALS[item.tag.toLowerCase()]?.image ??
                    "/media/sports/football.svg"
                  }
                  alt=""
                  loading="lazy"
                />
                <span>{SPORTS_VISUALS[item.tag.toLowerCase()]?.label ?? item.tag}</span>
              </div>
            ) : null}
            <div className="card-index">{String(index + 1).padStart(2, "0")}</div>
            <div className="card-chip-row">
              {!hideItemTags ? <span className="chip">{item.tag}</span> : <span />}
              <span className="muted">{item.source}</span>
            </div>
            <h3>{item.title}</h3>
            {expanded && item.summary ? (
              <p className="top-card-summary">{item.summary}</p>
            ) : null}
            <p className="muted">
              {new Intl.DateTimeFormat("en", {
                hour: "2-digit",
                minute: "2-digit",
                month: "short",
                day: "numeric",
                timeZone: "UTC",
              }).format(new Date(item.publishedAt))}
            </p>
          </a>
        ))}
      </div>
    </section>
  );
}
