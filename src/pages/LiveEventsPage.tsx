import { useParams } from "react-router-dom";
import { LiveEventsSection } from "../components/LiveEventsSection";
import { Seo } from "../components/Seo";
import { useContent } from "../hooks/useContent";
import { LiveEventsFeed } from "../types/content";

const categoryCopy = {
  earth: {
    eyebrow: "Live Earth",
    title: "Earth events",
    description: "Earthquakes, atmospheric signals, and other public-interest events with repeat-visit potential.",
  },
  space: {
    eyebrow: "Live Space",
    title: "Space events",
    description: "Launches, NASA programming, and astronomy moments that benefit from clean source-backed event pages.",
  },
};

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(new Date(value));
}

export function LiveEventsPage() {
  const { category } = useParams();
  const feed = useContent<LiveEventsFeed>("/content/live/events.json");

  const selectedCategory =
    category === "space" || category === "earth" ? category : undefined;
  const copy = selectedCategory ? categoryCopy[selectedCategory] : null;
  const filteredItems = (feed.data?.items ?? []).filter((item) =>
    selectedCategory ? item.category === selectedCategory : true,
  );
  const sourceCount = new Set(filteredItems.map((item) => item.sourceName)).size;
  const categoryCount = new Set(filteredItems.map((item) => item.category)).size;
  const now = Date.now();
  const liveNowItems = filteredItems.filter(
    (item) => item.status === "monitoring" || item.status === "watch" || item.status === "live",
  );
  const upcomingItems = filteredItems
    .filter((item) => item.status === "upcoming")
    .sort((left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt));
  const nextUpItem = upcomingItems[0] ?? null;
  const laterTodayItems = upcomingItems.filter((item) => {
    const startsAt = Date.parse(item.startsAt);
    return Number.isFinite(startsAt) && startsAt > now && startsAt - now <= 24 * 60 * 60 * 1000;
  });

  return (
    <>
      <Seo
        title={selectedCategory ? `${copy?.title} | XLB` : "Live Events | XLB"}
        description={
          selectedCategory
            ? copy?.description ?? ""
            : "Source-backed live events across space and earth topics."
        }
        path={selectedCategory ? `/live/${selectedCategory}` : "/live"}
      />
      <section className={`live-page-hero ${selectedCategory ? `live-page-hero-${selectedCategory}` : ""}`}>
        <div className="live-page-hero-copy">
          <p className="section-eyebrow">{copy?.eyebrow ?? "Live Events"}</p>
          <h1>{copy?.title ?? "Public-interest live events"}</h1>
          <p>
            {copy?.description ??
              "A clean feed of public-interest moments across space and earth, built for quick scanning and easy follow-through."}
          </p>
        </div>
        <div className="live-page-hero-rail">
          <div className="signal-panel">
            <span>Events</span>
            <strong>{filteredItems.length}</strong>
          </div>
          <div className="signal-panel">
            <span>Sources</span>
            <strong>{sourceCount}</strong>
          </div>
          <div className="signal-panel">
            <span>Categories</span>
            <strong>{categoryCount}</strong>
          </div>
        </div>
      </section>
      <section className="section-block">
        <div className="live-rail-grid">
          <article className="card sticky-panel">
            <p className="section-eyebrow">Live Now</p>
            <h2>What is worth checking right now</h2>
            <div className="sticky-list">
              {liveNowItems.slice(0, 3).map((item) => (
                <div className="sticky-row" key={item.id}>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.sourceName}</p>
                  </div>
                  <span className={`live-status live-status-${item.status}`}>{item.status}</span>
                </div>
              ))}
            </div>
          </article>
          <article className="card sticky-panel">
            <p className="section-eyebrow">Next Up</p>
            <h2>The closest upcoming event</h2>
            {nextUpItem ? (
              <div className="sticky-highlight">
                <strong>{nextUpItem.title}</strong>
                <p>{nextUpItem.summary}</p>
                <span>{formatShortDate(nextUpItem.startsAt)}</span>
              </div>
            ) : (
              <p className="muted">No scheduled event is queued next yet.</p>
            )}
          </article>
          <article className="card sticky-panel">
            <p className="section-eyebrow">Later Today</p>
            <h2>Coming up in the next 24 hours</h2>
            <div className="sticky-list">
              {laterTodayItems.length > 0 ? (
                laterTodayItems.slice(0, 3).map((item) => (
                  <div className="sticky-row" key={item.id}>
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.sourceName}</p>
                    </div>
                    <span>{formatShortDate(item.startsAt)}</span>
                  </div>
                ))
              ) : (
                <p className="muted">Nothing new is scheduled inside the next 24 hours.</p>
              )}
            </div>
          </article>
        </div>
      </section>
      <LiveEventsSection
        eyebrow={copy?.eyebrow ?? "Live"}
        title={copy?.title ?? "Event inventory"}
        description={
          copy?.description ??
          "Source-backed moments to watch, track, and revisit."
        }
        updatedAt={feed.data?.updatedAt}
        loading={feed.loading}
        error={feed.error}
        items={feed.data?.items}
        categoryFilter={selectedCategory}
      />
    </>
  );
}
