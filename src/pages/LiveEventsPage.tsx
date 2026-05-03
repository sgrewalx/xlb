import { Link, useParams } from "react-router-dom";
import { LiveEventsSection } from "../components/LiveEventsSection";
import { Seo } from "../components/Seo";
import { useContent } from "../hooks/useContent";
import { LiveEventsFeed, LiveEventScoreboard } from "../types/content";

const categoryCopy = {
  earth: {
    eyebrow: "Live Earth",
    title: "Earth live events",
    description: "Continuous public-information monitoring and other earth signals that make repeat visits rational.",
  },
  space: {
    eyebrow: "Live Space",
    title: "Space live events",
    description: "Launches, aurora conditions, and recurring watch surfaces with clear internal follow-through.",
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

function countdownLabel(value: string) {
  const diff = Date.parse(value) - Date.now();
  if (!Number.isFinite(diff)) {
    return "TBD";
  }
  if (diff <= 0) {
    return "Starting";
  }
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours >= 24) {
    return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export function LiveEventsPage() {
  const { category } = useParams();
  const feed = useContent<LiveEventsFeed>("/content/live/events.json", { refreshMs: 60000 });
  const scoreboard = useContent<LiveEventScoreboard>("/content/live/scoreboard.json", { refreshMs: 60000 });

  const selectedCategory =
    category === "space" || category === "earth" ? category : undefined;
  const copy = selectedCategory ? categoryCopy[selectedCategory] : null;
  const filteredItems = (feed.data?.items ?? []).filter((item) =>
    selectedCategory ? item.category === selectedCategory : true,
  );
  const sourceCount = new Set(filteredItems.map((item) => item.sourceName)).size;
  const liveNowItems = filteredItems.filter((item) =>
    ["monitoring", "watch", "live"].includes(item.status),
  );
  const upcomingItems = filteredItems
    .filter((item) => item.status === "upcoming")
    .sort((left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt));
  const earthquake = filteredItems.find((item) => item.slug === "global-earthquake-watch");
  const aurora = filteredItems.find((item) => item.slug === "aurora-watch");
  const mostClicked = [...(scoreboard.data?.items ?? [])]
    .filter((item) => (selectedCategory ? item.category === selectedCategory : true))
    .sort((left, right) => {
      const leftScore = left.pageviews * 3 + left.engagementScore;
      const rightScore = right.pageviews * 3 + right.engagementScore;
      return rightScore - leftScore;
    })
    .slice(0, 4);

  return (
    <>
      <Seo
        title={selectedCategory ? `${copy?.title} | XLB` : "Live Events | XLB"}
        description={
          selectedCategory
            ? copy?.description ?? ""
            : "Live public-interest events across space and earth, with active monitoring pages, watch windows, and short-form follow-through."
        }
        path={selectedCategory ? `/live/${selectedCategory}` : "/live"}
      />
      <section className={`live-page-hero ${selectedCategory ? `live-page-hero-${selectedCategory}` : ""}`}>
        <div className="live-page-hero-copy">
          <p className="section-eyebrow">{copy?.eyebrow ?? "Live Events"}</p>
          <h1>{copy?.title ?? "Live event pages built for repeat checks"}</h1>
          <p>
            {copy?.description ??
              "This page now highlights always-on public signals, scheduled watch windows, and the highest-traffic live pages instead of just listing cards."}
          </p>
        </div>
        <div className="live-page-hero-rail">
          <div className="signal-panel signal-panel-accent">
            <span>Live now</span>
            <strong>{liveNowItems.length}</strong>
          </div>
          <div className="signal-panel">
            <span>Upcoming</span>
            <strong>{upcomingItems.length}</strong>
          </div>
          <div className="signal-panel">
            <span>Sources</span>
            <strong>{sourceCount}</strong>
          </div>
        </div>
      </section>

      <section className="section-block">
        <div className="live-signal-grid">
          <article className="card sticky-panel">
            <p className="section-eyebrow">Earthquake Stream</p>
            <h2>{earthquake?.title ?? "Global earthquake watch"}</h2>
            <p>{earthquake?.summary ?? "Continuous USGS earthquake monitoring."}</p>
            <div className="event-related-list">
              <Link className="event-related-link" to="/events/global-earthquake-watch">
                Open live feed
              </Link>
              <Link className="event-related-link" to="/live/earth">
                Earth rail
              </Link>
            </div>
          </article>

          <article className="card sticky-panel">
            <p className="section-eyebrow">Aurora / Kp Stream</p>
            <h2>{aurora?.title ?? "Aurora watch"}</h2>
            <p>{aurora?.summary ?? "Current planetary K-index conditions from NOAA."}</p>
            <div className="event-related-list">
              <Link className="event-related-link" to="/events/aurora-watch">
                Open live feed
              </Link>
              <Link className="event-related-link" to="/live/space">
                Space rail
              </Link>
            </div>
          </article>

          <article className="card sticky-panel">
            <p className="section-eyebrow">Launch Countdown Rail</p>
            <h2>Upcoming watch windows</h2>
            <div className="sticky-list">
              {upcomingItems.slice(0, 3).map((item) => (
                <Link className="sticky-row" key={item.id} to={`/events/${item.slug}`}>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.sourceName}</p>
                  </div>
                  <span>{countdownLabel(item.startsAt)}</span>
                </Link>
              ))}
            </div>
          </article>

          <article className="card sticky-panel">
            <p className="section-eyebrow">Most-clicked live pages</p>
            <h2>Where current attention is landing</h2>
            <div className="sticky-list">
              {mostClicked.map((item) => (
                <Link className="sticky-row" key={item.slug} to={item.pagePath}>
                  <div>
                    <strong>{item.pagePath.replace("/events/", "").replace("/topics/", "")}</strong>
                    <p>{item.recommendation}</p>
                  </div>
                  <span>{item.pageviews} views</span>
                </Link>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section className="section-block">
        <div className="section-header">
          <div>
            <p className="section-eyebrow">Current Context</p>
            <h2>What is moving inside the next 24 hours</h2>
          </div>
          <div className="section-meta">
            <p>The launch rail and the current monitoring pages are the main reasons someone should return to this section.</p>
          </div>
        </div>
        <div className="live-timeline-grid">
          {upcomingItems.slice(0, 4).map((item) => (
            <Link className="card live-timeline-card" key={item.id} to={`/events/${item.slug}`}>
              <span className="traffic-module-label">{countdownLabel(item.startsAt)}</span>
              <h3>{item.title}</h3>
              <p>{item.summary}</p>
              <small>{formatShortDate(item.startsAt)}</small>
            </Link>
          ))}
        </div>
      </section>

      <LiveEventsSection
        eyebrow={copy?.eyebrow ?? "Live"}
        title={copy?.title ?? "Event inventory"}
        description={
          copy?.description ??
          "Promoted live pages sorted for repeat-check value, source clarity, and internal follow-through."
        }
        updatedAt={feed.data?.updatedAt}
        loading={feed.loading}
        error={feed.error}
        items={feed.data?.items}
        scores={scoreboard.data?.items}
        showPerformance
        categoryFilter={selectedCategory}
      />
    </>
  );
}
