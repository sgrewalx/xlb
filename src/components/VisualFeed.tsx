import { VisualItem } from "../types/content";
import { SectionHeader } from "./SectionHeader";

interface VisualFeedProps {
  items?: VisualItem[];
  loading: boolean;
  error: string | null;
  updatedAt?: string;
}

export function VisualFeed({ items, loading, error, updatedAt }: VisualFeedProps) {
  return (
    <section id="visuals" className="section-block">
      <SectionHeader
        eyebrow="Gallery"
        title="Visual feed"
        description="Curated, safe, aesthetic tiles. No user uploads. No uncontrolled feeds."
        updatedAt={updatedAt}
      />
      <div className="visual-grid">
        {loading
          ? Array.from({ length: 4 }).map((_, index) => (
              <article className="card card-skeleton visual-card" key={index}>
                <div className="visual-skeleton" />
                <div className="skeleton-line skeleton-tag" />
                <div className="skeleton-line skeleton-title" />
              </article>
            ))
          : null}

        {error ? (
          <article className="card card-error">
            <p>Visual feed unavailable.</p>
            <span>{error}</span>
          </article>
        ) : null}

        {items?.map((item) => (
          <article className="card visual-card" key={item.id}>
            <img src={item.image} alt={item.alt} loading="lazy" />
            <div className="card-chip-row">
              <span className="chip">{item.category}</span>
              <span className="muted">{item.credit}</span>
            </div>
            <h3>{item.title}</h3>
          </article>
        ))}
      </div>
    </section>
  );
}
