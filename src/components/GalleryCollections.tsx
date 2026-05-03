import { Link } from "react-router-dom";
import { trackGalleryOpen } from "../lib/analytics";
import { GalleryCollectionItem } from "../types/content";
import { SectionHeader } from "./SectionHeader";

interface GalleryCollectionsProps {
  items?: GalleryCollectionItem[];
  loading: boolean;
  error: string | null;
  updatedAt?: string;
}

export function GalleryCollections({ items, loading, error, updatedAt }: GalleryCollectionsProps) {
  return (
    <section className="section-block" id="gallery-collections">
      <SectionHeader
        eyebrow="Gallery"
        title="Live visual explainers"
        description="Every collection below should route into a current event, live page, or topic page. Nothing here should be a dead end."
        updatedAt={updatedAt}
      />
      <div className="gallery-collection-grid">
        {loading
          ? Array.from({ length: 4 }).map((_, index) => (
              <article className="card card-skeleton gallery-collection-card" key={`gallery-${index}`}>
                <div className="skeleton-line skeleton-title" />
                <div className="skeleton-line skeleton-copy" />
              </article>
            ))
          : null}
        {error ? (
          <article className="card card-error">
            <p>Could not load gallery collections.</p>
            <span>{error}</span>
          </article>
        ) : null}
        {items?.map((collection) => (
          <article className="card gallery-collection-card" key={collection.id}>
            <div className="card-chip-row">
              <span className={`chip chip-${collection.category === "quake" ? "earth" : "space"}`}>
                {collection.category}
              </span>
              <Link className="muted" to={collection.relatedPath}>
                {collection.relatedLabel}
              </Link>
            </div>
            <h3>{collection.title}</h3>
            <p className="top-card-summary">{collection.description}</p>
            <div className="gallery-entry-list">
              {collection.entries.map((entry) => (
                <Link
                  className={`gallery-entry-card gallery-entry-card-${entry.accent}`}
                  key={entry.id}
                  onClick={() => trackGalleryOpen(collection.id, entry.id, entry.href)}
                  to={entry.href}
                >
                  <span className="gallery-entry-metric">{entry.metricLabel}</span>
                  <strong>{entry.metricValue}</strong>
                  <h4>{entry.title}</h4>
                  <p>{entry.summary}</p>
                </Link>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
