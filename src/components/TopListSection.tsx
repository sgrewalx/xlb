import { FeedItem } from "../types/content";
import { SectionHeader } from "./SectionHeader";

interface TopListSectionProps {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  loading: boolean;
  error: string | null;
  updatedAt?: string;
  items?: FeedItem[];
}

export function TopListSection({
  id,
  eyebrow,
  title,
  description,
  loading,
  error,
  updatedAt,
  items,
}: TopListSectionProps) {
  return (
    <section id={id} className="section-block">
      <SectionHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        updatedAt={updatedAt}
      />
      <div className="top-grid">
        {loading
          ? Array.from({ length: 3 }).map((_, index) => (
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
            <div className="card-index">{String(index + 1).padStart(2, "0")}</div>
            <div className="card-chip-row">
              <span className="chip">{item.tag}</span>
              <span className="muted">{item.source}</span>
            </div>
            <h3>{item.title}</h3>
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
