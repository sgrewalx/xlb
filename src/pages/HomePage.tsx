import { Link } from "react-router-dom";
import { LiveEventsSection } from "../components/LiveEventsSection";
import { Seo } from "../components/Seo";
import { useContent } from "../hooks/useContent";
import { trackHomeLiveCardClick } from "../lib/analytics";
import {
  HomeModule,
  HomeModulesFeed,
  LiveEventsFeed,
  LiveEventScoreboard,
} from "../types/content";

const FEATURED_VIDEO = {
  id: "homepage-featured-video",
  title: "Featured video",
  url: "https://www.youtube.com/watch?v=HfgIFGbdGJ0",
  embedUrl: "https://www.youtube.com/embed/HfgIFGbdGJ0?rel=0",
};

function CompactModuleCard({ item }: { item: HomeModule }) {
  return (
    <article className="card compact-module-card">
      <div className="card-chip-row">
        <span className="chip chip-earth">{item.title}</span>
        <Link
          className="muted"
          onClick={() => trackHomeLiveCardClick(item.id, item.ctaUrl)}
          to={item.ctaUrl}
        >
          {item.ctaLabel}
        </Link>
      </div>
      <div className="compact-link-list">
        {item.items.slice(0, 3).map((entry) => (
          <Link
            className="compact-link-row"
            key={entry.id}
            onClick={() => trackHomeLiveCardClick(item.id, entry.href)}
            to={entry.href}
          >
            <strong>{entry.title}</strong>
            <small>{entry.label}</small>
          </Link>
        ))}
      </div>
    </article>
  );
}

export function HomePage() {
  const modules = useContent<HomeModulesFeed>("/content/home/modules.json", { refreshMs: 60000 });
  const liveEvents = useContent<LiveEventsFeed>("/content/live/events.json", { refreshMs: 60000 });
  const liveScoreboard = useContent<LiveEventScoreboard>("/content/live/scoreboard.json", { refreshMs: 60000 });

  return (
    <>
      <Seo
        title="XLB | Watch now"
        description="Live events, live video, and fast paths into the most active pages on XLB."
        path="/"
      />
      <section className="live-page-hero home-traffic-hero">
        <div className="live-page-hero-copy">
          <p className="section-eyebrow">Watch Now</p>
          <h1>Live. Video. Fast.</h1>
          <p>Open the stream or jump straight into the live pages.</p>
        </div>
        <div className="live-page-hero-rail">
          <div className="signal-panel signal-panel-accent">
            <span>Live events</span>
            <strong>{liveEvents.data?.items.filter((item) => item.safeToPromote).length ?? "..."}</strong>
          </div>
          <div className="signal-panel">
            <span>Top paths</span>
            <strong>{modules.data?.items.length ?? "..."}</strong>
          </div>
        </div>
      </section>

      <section className="section-block">
        <div className="featured-home-video">
          <article className="card home-video-card">
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
                loading="lazy"
              />
            </div>
          </article>

          <div className="compact-module-grid">
            {modules.data?.items.map((item) => (
              <CompactModuleCard item={item} key={item.id} />
            ))}
            <article className="card compact-module-card">
              <div className="card-chip-row">
                <span className="chip chip-space">Quick links</span>
                <Link className="muted" to="/live">
                  Open Live
                </Link>
              </div>
              <div className="compact-link-list">
                <Link className="compact-link-row" to="/live">
                  <strong>Live</strong>
                  <small>Now</small>
                </Link>
                <Link className="compact-link-row" to="/video">
                  <strong>Video</strong>
                  <small>Watch</small>
                </Link>
                <Link className="compact-link-row" to="/events/aurora-watch">
                  <strong>Aurora</strong>
                  <small>Kp</small>
                </Link>
              </div>
            </article>
          </div>
        </div>
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
