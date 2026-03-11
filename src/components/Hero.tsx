import { FeedItem } from "../types/content";

interface HeroProps {
  loading: boolean;
  error: string | null;
  items?: FeedItem[];
}

const HERO_LABELS: Record<string, string> = {
  experience: "X",
  love: "L",
  bonding: "B",
};

export function Hero({ loading, error, items }: HeroProps) {
  return (
    <section className="hero-panel">
      <div className="hero-letter-stack" aria-label="XLB intro panels">
        {loading
          ? Array.from({ length: 3 }).map((_, index) => (
              <article className="hero-card hero-letter-card card-skeleton" key={`hero-${index}`}>
                <div className="skeleton-line skeleton-tag" />
                <div className="skeleton-line skeleton-title" />
                <div className="skeleton-line skeleton-copy" />
              </article>
            ))
          : null}

        {error ? (
          <article className="hero-card hero-letter-card card-error">
            <p>Could not load these stories.</p>
            <span>{error}</span>
          </article>
        ) : null}

        {items?.map((item) => (
          <article
            className={`hero-card hero-letter-card hero-letter-card-${HERO_LABELS[item.tag.toLowerCase()]?.toLowerCase() ?? "x"}`}
            key={item.id}
          >
            <p className="section-eyebrow hero-letter-label">
              {HERO_LABELS[item.tag.toLowerCase()] ?? item.tag.slice(0, 1)}
            </p>
            <h2 className="hero-story-title">{item.title}</h2>
            <div className="hero-story-meta">
              <span>{item.source}</span>
              <span>
                {new Intl.DateTimeFormat("en", {
                  month: "short",
                  day: "numeric",
                  timeZone: "UTC",
                }).format(new Date(item.publishedAt))}
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
