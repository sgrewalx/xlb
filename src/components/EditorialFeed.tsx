import { useEffect, useMemo, useState } from "react";
import { getSportsFallbackVisual } from "../lib/editorialVisuals";
import { FeedItem } from "../types/content";

type EditorialSection = "news" | "sports" | "tech";

interface EditorialFeedProps {
  section: EditorialSection;
  eyebrow: string;
  title: string;
  description: string;
  loading: boolean;
  error: string | null;
  updatedAt?: string;
  items?: FeedItem[];
}

const NEWS_VISUALS = [
  "/media/visuals/tokyo-midnight.svg",
  "/media/visuals/runway-notes.svg",
  "/media/modules/weather.svg",
  "/media/modules/ships.svg",
];

const TECH_VISUALS: Record<string, string> = {
  AI: "/media/modules/satellites.svg",
  Devices: "/media/modules/lightning.svg",
  Policy: "/media/visuals/runway-notes.svg",
  Security: "/media/modules/weather.svg",
  Startups: "/media/visuals/studio-sprint.svg",
  Technology: "/media/modules/satellites.svg",
};

export function EditorialFeed({
  section,
  eyebrow,
  title,
  description,
  loading,
  error,
  updatedAt,
  items,
}: EditorialFeedProps) {
  const [selectedCategory, setSelectedCategory] = useState("All");
  const categories = useMemo(
    () => [
      "All",
      ...new Set((items ?? []).map((item) => getDisplayCategory(item, section))),
    ],
    [items, section],
  );
  const visibleItems = useMemo(
    () => (items ?? []).filter((item) => (
      selectedCategory === "All" || getDisplayCategory(item, section) === selectedCategory
    )),
    [items, section, selectedCategory],
  );
  const lead = visibleItems[0];
  const secondary = visibleItems.slice(1, 4);
  const moreStories = visibleItems.slice(4);

  return (
    <section className={`editorial-feed editorial-feed-${section}`} aria-labelledby={`${section}-title`}>
      <header className="editorial-masthead">
        <div className="editorial-title-block">
          <p className="section-eyebrow">{eyebrow}</p>
          <h1 id={`${section}-title`}>{title}</h1>
        </div>
        <div className="editorial-intro">
          <p>{description}</p>
          {updatedAt ? <span>Updated {formatDate(updatedAt)}</span> : null}
        </div>
      </header>

      {!loading && !error && categories.length > 2 ? (
        <div className="editorial-tabs" role="tablist" aria-label={`${eyebrow} categories`}>
          {categories.map((category) => (
            <button
              aria-selected={selectedCategory === category}
              className={selectedCategory === category ? "is-active" : ""}
              key={category}
              onClick={() => setSelectedCategory(category)}
              role="tab"
              type="button"
            >
              {category}
            </button>
          ))}
        </div>
      ) : null}

      {loading ? <EditorialSkeleton /> : null}

      {error ? (
        <div className="editorial-error" role="status">
          <strong>Stories are temporarily unavailable.</strong>
          <span>{error}</span>
        </div>
      ) : null}

      {!loading && !error && lead ? (
        <>
          <div className="editorial-feature-layout">
            <FeaturedStoryCard item={lead} section={section} />
            {secondary.length > 0 ? (
              <div className="editorial-secondary-grid" aria-label="Top stories">
                {secondary.map((item, index) => (
                  <StoryCard
                    item={item}
                    key={item.id}
                    section={section}
                    visualIndex={index + 1}
                  />
                ))}
              </div>
            ) : null}
          </div>

          {moreStories.length > 0 ? (
            <section className="editorial-more" aria-labelledby={`${section}-more-title`}>
              <div className="editorial-section-heading">
                <h2 id={`${section}-more-title`}>More stories</h2>
                <span>{moreStories.length} to explore</span>
              </div>
              <div className="editorial-compact-grid">
                {moreStories.map((item, index) => (
                  <CompactStoryCard
                    item={item}
                    key={item.id}
                    section={section}
                    visualIndex={index + 4}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : null}

      {!loading && !error && !lead ? (
        <div className="editorial-error" role="status">
          <strong>No stories in this category yet.</strong>
          <span>Choose another category to continue.</span>
        </div>
      ) : null}
    </section>
  );
}

function FeaturedStoryCard({ item, section }: { item: FeedItem; section: EditorialSection }) {
  return (
    <a className="editorial-lead-card" href={item.url} target="_blank" rel="noreferrer">
      <StoryVisual item={item} section={section} visualIndex={0} priority />
      <div className="editorial-lead-copy">
        <StoryMeta item={item} section={section} />
        <h2>{item.title}</h2>
        {item.summary ? <p>{item.summary}</p> : null}
        <span className="editorial-read-link">Read full story</span>
      </div>
    </a>
  );
}

function StoryCard({
  item,
  section,
  visualIndex,
}: {
  item: FeedItem;
  section: EditorialSection;
  visualIndex: number;
}) {
  return (
    <a className="editorial-story-card" href={item.url} target="_blank" rel="noreferrer">
      <StoryVisual item={item} section={section} visualIndex={visualIndex} />
      <div className="editorial-story-copy">
        <StoryMeta item={item} section={section} />
        <h3>{item.title}</h3>
        {item.summary ? <p>{item.summary}</p> : null}
      </div>
    </a>
  );
}

function CompactStoryCard({
  item,
  section,
  visualIndex,
}: {
  item: FeedItem;
  section: EditorialSection;
  visualIndex: number;
}) {
  return (
    <a className="editorial-compact-card" href={item.url} target="_blank" rel="noreferrer">
      <StoryVisual item={item} section={section} visualIndex={visualIndex} compact />
      <div className="editorial-compact-copy">
        <StoryMeta item={item} section={section} />
        <h3>{item.title}</h3>
        {item.summary ? <p>{item.summary}</p> : null}
      </div>
    </a>
  );
}

function StoryMeta({ item, section }: { item: FeedItem; section: EditorialSection }) {
  return (
    <div className="editorial-story-meta">
      <span className="editorial-category">{getDisplayCategory(item, section)}</span>
      <span>{item.source}</span>
      <time dateTime={item.publishedAt}>{formatDate(item.publishedAt)}</time>
    </div>
  );
}

function StoryVisual({
  item,
  section,
  visualIndex,
  compact = false,
  priority = false,
}: {
  item: FeedItem;
  section: EditorialSection;
  visualIndex: number;
  compact?: boolean;
  priority?: boolean;
}) {
  const [sourceFailed, setSourceFailed] = useState(false);
  const [fallbackFailed, setFallbackFailed] = useState(false);
  const fallback = getFallbackVisual(item, section, visualIndex);
  const useSource = Boolean(item.image && !sourceFailed);
  const image = useSource ? item.image : fallbackFailed ? "" : fallback;
  const category = getDisplayCategory(item, section);

  useEffect(() => {
    setSourceFailed(false);
    setFallbackFailed(false);
  }, [item.image, fallback]);

  return (
    <div className={`editorial-visual editorial-visual-${section} ${compact ? "is-compact" : ""}`}>
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
          referrerPolicy={useSource ? "no-referrer" : undefined}
          src={image}
        />
      ) : (
        <span className="editorial-visual-fallback" aria-hidden="true">
          {sourceInitials(item.source)}
        </span>
      )}
      <span className="editorial-visual-label">{category}</span>
    </div>
  );
}

function EditorialSkeleton() {
  return (
    <div className="editorial-feature-layout" aria-label="Loading stories">
      <div className="editorial-skeleton editorial-skeleton-lead" />
      <div className="editorial-secondary-grid">
        {Array.from({ length: 3 }, (_, index) => (
          <div className="editorial-skeleton" key={index} />
        ))}
      </div>
    </div>
  );
}

function getDisplayCategory(item: FeedItem, section: EditorialSection) {
  if (section !== "tech" || item.tag !== "Technology") {
    return item.tag;
  }

  const text = `${item.title} ${item.summary ?? ""}`.toLowerCase();

  if (/\b(ai|artificial intelligence|machine learning|robot|agent)\b/.test(text)) return "AI";
  if (/\b(security|privacy|cyber|hack|breach|malware)\b/.test(text)) return "Security";
  if (/\b(law|court|policy|regulat|government|legal)\w*\b/.test(text)) return "Policy";
  if (/\b(startup|funding|acquisition|venture|founder)\w*\b/.test(text)) return "Startups";
  if (/\b(phone|smartphone|device|chip|hardware|laptop|monitor|console)\w*\b/.test(text)) return "Devices";

  return "Technology";
}

function getFallbackVisual(item: FeedItem, section: EditorialSection, index: number) {
  if (section === "sports") {
    return getSportsFallbackVisual(item.tag);
  }

  if (section === "tech") {
    return TECH_VISUALS[getDisplayCategory(item, section)] ?? TECH_VISUALS.Technology;
  }

  return NEWS_VISUALS[index % NEWS_VISUALS.length];
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(new Date(value));
}

function sourceInitials(source: string) {
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}
