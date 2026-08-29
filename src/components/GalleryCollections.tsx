import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { trackGalleryOpen } from "../lib/analytics";
import { GalleryCollectionEntry, GalleryCollectionItem } from "../types/content";

interface GalleryCollectionsProps {
  items?: GalleryCollectionItem[];
  loading: boolean;
  error: string | null;
  updatedAt?: string;
}

export function GalleryCollections({ items, loading, error, updatedAt }: GalleryCollectionsProps) {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const featured = items?.[0];
  const discoveryItems = useMemo(
    () => (items ?? [])
      .slice(1)
      .filter((collection) => selectedCategory === "all" || collection.category === selectedCategory)
      .flatMap((collection) => collection.entries.map((entry) => ({ collection, entry }))),
    [items, selectedCategory],
  );
  const categories = items?.slice(1) ?? [];

  return (
    <section className="gallery-browser" id="gallery-collections" aria-labelledby="gallery-title">
      <header className="gallery-browser-header">
        <div>
          <p className="section-eyebrow">Gallery</p>
          <h1 id="gallery-title">The world in signals</h1>
        </div>
        <div className="gallery-browser-intro">
          <p>Visual snapshots from the live events and topics changing now.</p>
          {updatedAt ? <span>Updated {formatTimestamp(updatedAt)}</span> : null}
        </div>
      </header>

      {loading ? <GallerySkeleton /> : null}

      {error ? (
        <div className="gallery-browser-error" role="status">
          <strong>Gallery collections are temporarily unavailable.</strong>
          <span>{error}</span>
        </div>
      ) : null}

      {!loading && !error && featured ? (
        <FeaturedCollection collection={featured} />
      ) : null}

      {!loading && !error && discoveryItems.length > 0 ? (
        <section className="gallery-discovery" aria-labelledby="gallery-discovery-title">
          <div className="gallery-discovery-header">
            <div>
              <p className="section-eyebrow">Browse</p>
              <h2 id="gallery-discovery-title">Visual collections</h2>
            </div>
            <div className="gallery-filter-tabs" role="tablist" aria-label="Gallery collections">
              <button
                aria-selected={selectedCategory === "all"}
                className={selectedCategory === "all" ? "is-active" : ""}
                onClick={() => setSelectedCategory("all")}
                role="tab"
                type="button"
              >
                All
              </button>
              {categories.map((collection) => (
                <button
                  aria-selected={selectedCategory === collection.category}
                  className={selectedCategory === collection.category ? "is-active" : ""}
                  key={collection.id}
                  onClick={() => setSelectedCategory(collection.category)}
                  role="tab"
                  type="button"
                >
                  {categoryLabel(collection.category)}
                </button>
              ))}
            </div>
          </div>

          <div className="gallery-discovery-grid">
            {discoveryItems.map(({ collection, entry }, index) => (
              <GalleryDiscoveryCard
                collection={collection}
                entry={entry}
                index={index}
                key={`${collection.id}-${entry.id}`}
              />
            ))}
          </div>
        </section>
      ) : null}

      {!loading && !error && !featured ? (
        <div className="gallery-browser-error" role="status">
          <strong>No visual collections are available yet.</strong>
        </div>
      ) : null}
    </section>
  );
}

function FeaturedCollection({ collection }: { collection: GalleryCollectionItem }) {
  return (
    <section className="gallery-featured" aria-labelledby="gallery-featured-title">
      <Link className="gallery-featured-visual" to={collection.relatedPath}>
        <GalleryImage category={collection.category} index={0} priority />
        <div className="gallery-featured-overlay">
          <span className="gallery-cue">Featured</span>
          <h2 id="gallery-featured-title">{collection.title}</h2>
          <p>{collection.description}</p>
          <strong>{collection.relatedLabel}</strong>
        </div>
      </Link>
      <div className="gallery-featured-links" aria-label={`${collection.title} links`}>
        {collection.entries.map((entry) => (
          <Link
            key={entry.id}
            onClick={() => trackGalleryOpen(collection.id, entry.id, entry.href)}
            to={entry.href}
          >
            <span>{entry.metricLabel}</span>
            <strong>{entry.metricValue}</strong>
            <h3>{entry.title}</h3>
          </Link>
        ))}
      </div>
    </section>
  );
}

function GalleryDiscoveryCard({
  collection,
  entry,
  index,
}: {
  collection: GalleryCollectionItem;
  entry: GalleryCollectionEntry;
  index: number;
}) {
  const layout = index % 5 === 0 || index % 5 === 4 ? "is-wide" : "is-standard";

  return (
    <Link
      className={`gallery-discovery-card ${layout}`}
      onClick={() => trackGalleryOpen(collection.id, entry.id, entry.href)}
      to={entry.href}
    >
      <GalleryImage category={collection.category} index={index + 1} />
      <div className="gallery-discovery-copy">
        <div className="gallery-discovery-meta">
          <span>{categoryLabel(collection.category)}</span>
          <span>{entry.metricLabel}</span>
          <strong>{entry.metricValue}</strong>
        </div>
        <h3>{entry.title}</h3>
        <p>{entry.summary}</p>
      </div>
    </Link>
  );
}

function GalleryImage({
  category,
  index,
  priority = false,
}: {
  category: GalleryCollectionItem["category"];
  index: number;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const image = visualFor(category, index);

  return (
    <div className={`gallery-image gallery-image-${category}`}>
      {!failed ? (
        <img
          alt=""
          loading={priority ? "eager" : "lazy"}
          onError={() => setFailed(true)}
          src={image}
        />
      ) : (
        <span aria-hidden="true">{categoryLabel(category)}</span>
      )}
      <span className="gallery-image-label">{categoryLabel(category)}</span>
    </div>
  );
}

function GallerySkeleton() {
  return (
    <div className="gallery-skeleton-layout" aria-label="Loading gallery">
      <div className="gallery-skeleton gallery-skeleton-featured" />
      <div className="gallery-skeleton-row">
        {Array.from({ length: 3 }, (_, index) => (
          <div className="gallery-skeleton" key={index} />
        ))}
      </div>
    </div>
  );
}

function visualFor(category: GalleryCollectionItem["category"], index: number) {
  const visuals: Record<GalleryCollectionItem["category"], string[]> = {
    quake: [
      "/media/modules/earthquakes.svg",
      "/media/modules/weather.svg",
      "/media/visuals/atlantic-club.svg",
    ],
    aurora: [
      "/media/modules/lightning.svg",
      "/media/modules/satellites.svg",
      "/media/visuals/tokyo-midnight.svg",
    ],
    launch: [
      "/media/modules/satellites.svg",
      "/media/modules/flights.svg",
      "/media/visuals/runway-notes.svg",
    ],
    topic: [
      "/media/visuals/runway-notes.svg",
      "/media/visuals/studio-sprint.svg",
      "/media/visuals/tokyo-midnight.svg",
    ],
  };
  const categoryVisuals = visuals[category];

  return categoryVisuals[index % categoryVisuals.length];
}

function categoryLabel(category: GalleryCollectionItem["category"]) {
  return {
    aurora: "Aurora",
    launch: "Launches",
    quake: "Earth",
    topic: "Topics",
  }[category];
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(new Date(value));
}
