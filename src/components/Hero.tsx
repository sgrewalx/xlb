import { Link } from "react-router-dom";
import { FeedItem, LiveEventItem } from "../types/content";

interface HeroProps {
  loading: boolean;
  error: string | null;
  items?: FeedItem[];
  liveItems?: LiveEventItem[];
}

interface HeroCardData {
  id: string;
  label: string;
  title: string;
  dek: string;
  meta: string;
  href: string;
  tone: "x" | "l" | "b";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function pickHeroCards(liveItems: LiveEventItem[] | undefined) {
  if (!liveItems?.length) {
    return [];
  }

  const liveNow =
    liveItems.find((item) => item.status === "monitoring" || item.status === "watch" || item.status === "live") ??
    liveItems[0];
  const nextUp =
    [...liveItems]
      .filter((item) => item.status === "upcoming")
      .sort((left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt))[0] ?? liveItems[1] ?? liveNow;
  const explore =
    liveItems.find((item) => item.slug !== liveNow.slug && item.slug !== nextUp.slug) ?? liveNow;

  return [
    {
      id: `hero-${liveNow.slug}`,
      label: "Now",
      title: liveNow.title,
      dek: liveNow.summary,
      meta: `${liveNow.sourceName} · ${liveNow.status === "watch" ? "Watch now" : "Tracking now"}`,
      href: `/events/${liveNow.slug}`,
      tone: "x",
    },
    {
      id: `hero-${nextUp.slug}`,
      label: "Next",
      title: nextUp.title,
      dek: nextUp.summary,
      meta: `${nextUp.sourceName} · ${formatDate(nextUp.startsAt)}`,
      href: `/events/${nextUp.slug}`,
      tone: "l",
    },
    {
      id: `hero-${explore.slug}`,
      label: "Explore",
      title: explore.title,
      dek: explore.summary,
      meta: `${explore.category} · ${explore.topic.replaceAll("-", " ")}`,
      href: `/topics/${explore.topic}`,
      tone: "b",
    },
  ] satisfies HeroCardData[];
}

export function Hero({ loading, error, items, liveItems }: HeroProps) {
  const liveCards = pickHeroCards(liveItems);

  return (
    <section className="hero-panel">
      <div className="hero-letter-stack" aria-label="XLB featured panels">
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

        {liveCards.length > 0
          ? liveCards.map((item) => (
              <Link
                className={`hero-card hero-letter-card hero-letter-card-${item.tone}`}
                key={item.id}
                to={item.href}
              >
                <p className="section-eyebrow hero-letter-label">{item.label}</p>
                <h2 className="hero-story-title">{item.title}</h2>
                <p className="hero-story-dek">{item.dek}</p>
                <div className="hero-story-meta">
                  <span>XLB</span>
                  <span>{item.meta}</span>
                </div>
              </Link>
            ))
          : items?.map((item, index) => (
              <article
                className={`hero-card hero-letter-card hero-letter-card-${index === 0 ? "x" : index === 1 ? "l" : "b"}`}
                key={item.id}
              >
                <p className="section-eyebrow hero-letter-label">
                  {index === 0 ? "Now" : index === 1 ? "Next" : "Explore"}
                </p>
                <h2 className="hero-story-title">{item.title}</h2>
                <p className="hero-story-dek">
                  {item.tag} from {item.source}
                </p>
                <div className="hero-story-meta">
                  <span>{item.source}</span>
                  <span>{formatDate(item.publishedAt)}</span>
                </div>
              </article>
            ))}
      </div>
    </section>
  );
}
