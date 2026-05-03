import { Link } from "react-router-dom";
import { LiveEventsSection } from "../components/LiveEventsSection";
import { Seo } from "../components/Seo";
import { useContent } from "../hooks/useContent";
import { trackHomeLiveCardClick } from "../lib/analytics";
import {
  LiveEventsFeed,
  LiveEventScoreboard,
} from "../types/content";

const FEATURED_VIDEO = {
  id: "homepage-featured-video",
  title: "Featured video",
  url: "https://www.youtube.com/watch?v=HfgIFGbdGJ0",
  embedUrl: "https://www.youtube.com/embed/HfgIFGbdGJ0?autoplay=1&mute=1&playsinline=1&rel=0",
};

export function HomePage() {
  const liveEvents = useContent<LiveEventsFeed>("/content/live/events.json", { refreshMs: 60000 });
  const liveScoreboard = useContent<LiveEventScoreboard>("/content/live/scoreboard.json", { refreshMs: 60000 });
  const featuredItems = (liveEvents.data?.items ?? []).filter((item) =>
    ["aurora-watch", "global-earthquake-watch", "nasa-live-programming"].includes(item.slug),
  );

  return (
    <>
      <Seo
        title="XLB | Watch now"
        description="Live events, live video, and fast paths into the most active pages on XLB."
        path="/"
      />
      <section className="live-page-hero home-traffic-hero">
        <div className="live-page-hero-copy">
          <div className="hero-pill-row">
            <span className="chip chip-space">Watch Now</span>
            {featuredItems.map((item) => (
              <Link
                className="hero-pill-link"
                key={item.id}
                onClick={() => trackHomeLiveCardClick("watch-now", `/events/${item.slug}`)}
                to={`/events/${item.slug}`}
              >
                {item.title}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section-block">
        <article className="card home-video-card home-video-card-full">
          <div className="card-chip-row">
            <span className="chip chip-space">Featured video</span>
            <a className="muted" href={FEATURED_VIDEO.url} rel="noreferrer" target="_blank">
              Open YouTube
            </a>
          </div>
          <div className="short-card-player">
            <iframe
              src={FEATURED_VIDEO.embedUrl}
              title={FEATURED_VIDEO.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="eager"
            />
          </div>
        </article>
      </section>

      <LiveEventsSection
        eyebrow="Live"
        title="Events"
        description="Current and next-up pages."
        updatedAt={liveEvents.data?.updatedAt}
        loading={liveEvents.loading}
        error={liveEvents.error}
        items={liveEvents.data?.items?.filter((item) => item.safeToPromote)}
        scores={liveScoreboard.data?.items}
        showPerformance
        limit={4}
      />
    </>
  );
}
