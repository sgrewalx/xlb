import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { trackGalleryOpen } from "../lib/analytics";
import {
  getConsumerMetric,
  getGalleryCategories,
  getGalleryDiscoveryItems,
  type GalleryCategory,
} from "../lib/galleryPresentation";
import { GalleryCollectionEntry, GalleryCollectionItem } from "../types/content";

interface GalleryCollectionsProps {
  items?: GalleryCollectionItem[];
  loading: boolean;
  error: string | null;
  updatedAt?: string;
}

export function GalleryCollections({ items, loading, error, updatedAt }: GalleryCollectionsProps) {
  const [selectedCategory, setSelectedCategory] = useState<"all" | GalleryCategory>("all");
  const featured = selectedCategory === "all" ? items?.[0] : undefined;
  const discoveryItems = useMemo(
    () => getGalleryDiscoveryItems(items ?? [], selectedCategory),
    [items, selectedCategory],
  );
  const categories = useMemo(() => getGalleryCategories(items ?? []), [items]);

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
              {categories.map((category) => (
                <button
                  aria-selected={selectedCategory === category}
                  className={selectedCategory === category ? "is-active" : ""}
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  role="tab"
                  type="button"
                >
                  {categoryLabel(category)}
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

      {!loading && !error && (items?.length ?? 0) === 0 ? (
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
        <GalleryImage category={collection.category} index={0} item={collection} priority />
        <div className="gallery-featured-overlay">
          <span className="gallery-cue">Featured</span>
          <h2 id="gallery-featured-title">{collection.title}</h2>
          <p>{collection.description}</p>
          <strong>{collection.relatedLabel}</strong>
        </div>
      </Link>
      <div className="gallery-featured-links" aria-label={`${collection.title} links`}>
        {collection.entries.map((entry) => {
          const metric = getConsumerMetric(entry);

          return (
            <Link
              key={entry.id}
              onClick={() => trackGalleryOpen(collection.id, entry.id, entry.href)}
              to={entry.href}
            >
              <span>{categoryLabel(collection.category)}</span>
              {metric ? <strong>{metric.label}: {metric.value}</strong> : null}
              <h3>{entry.title}</h3>
            </Link>
          );
        })}
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
  const metric = getConsumerMetric(entry);

  return (
    <Link
      className={`gallery-discovery-card ${layout}`}
      onClick={() => trackGalleryOpen(collection.id, entry.id, entry.href)}
      to={entry.href}
    >
      <GalleryImage category={collection.category} index={index + 1} item={entry} />
      <div className="gallery-discovery-copy">
        <div className="gallery-discovery-meta">
          <span>{categoryLabel(collection.category)}</span>
          {metric ? <span>{metric.label}</span> : null}
          {metric ? <strong>{metric.value}</strong> : null}
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
  item,
  priority = false,
}: {
  category: GalleryCollectionItem["category"];
  index: number;
  item: Pick<GalleryCollectionEntry, "image" | "imageAlt">;
  priority?: boolean;
}) {
  const [sourceFailed, setSourceFailed] = useState(false);
  const [fallbackFailed, setFallbackFailed] = useState(false);
  const fallback = visualFor(category, index);
  const useSource = Boolean(item.image && !sourceFailed);
  const image = useSource ? item.image : fallbackFailed ? "" : fallback;

  useEffect(() => {
    setSourceFailed(false);
    setFallbackFailed(false);
  }, [item.image, fallback]);

  return (
    <div className={`gallery-image gallery-image-${category}`}>
      {image ? (
        <img
          alt={useSource ? (item.imageAlt || "") : ""}
          decoding="async"
          fetchPriority={priority ? "high" : "auto"}
          loading={priority ? "eager" : "lazy"}
          onError={() => {
            if (useSource) {
              setSourceFailed(true);
            } else {
              setFallbackFailed(true);
            }
          }}
          referrerPolicy={useSource && image?.startsWith("https://") ? "no-referrer" : undefined}
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
