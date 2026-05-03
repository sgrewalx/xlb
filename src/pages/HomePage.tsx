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
  VideoShortsFeed,
} from "../types/content";

function HomeModuleCard({ item }: { item: HomeModule }) {
  return (
    <article className="card traffic-module-card">
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
      <h2>{item.title}</h2>
      <p>{item.description}</p>
      <div className="traffic-module-metrics">
        {item.metrics.map((metric) => (
          <div className="signal-panel" key={`${item.id}-${metric.label}`}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </div>
        ))}
      </div>
      <div className="traffic-module-list">
        {item.items.map((entry) => (
          <Link
            className="traffic-module-entry"
            key={entry.id}
            onClick={() => trackHomeLiveCardClick(item.id, entry.href)}
            to={entry.href}
          >
            <div>
              <span className="traffic-module-label">{entry.label}</span>
              <strong>{entry.title}</strong>
              <p>{entry.summary}</p>
            </div>
            <small>{entry.meta}</small>
          </Link>
        ))}
      </div>
      <div className="event-related-list">
        {item.relatedLinks.map((link) => (
          <Link
            className="event-related-link"
            key={`${item.id}-${link.href}`}
            onClick={() => trackHomeLiveCardClick(item.id, link.href)}
            to={link.href}
          >
            {link.label}
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
  const shorts = useContent<VideoShortsFeed>("/content/video/shorts.json", { refreshMs: 60000 });
  const leadShorts = shorts.data?.items.slice(0, 2) ?? [];

  return (
    <>
      <Seo
        title="XLB | Live events and shorts worth checking now"
        description="XLB is focused on live public-interest events and embedded short-form video that change often enough to bring people back."
        path="/"
      />
      <section className="live-page-hero home-traffic-hero">
        <div className="live-page-hero-copy">
          <p className="section-eyebrow">Live + Shorts</p>
          <h1>Live events and short videos worth checking now</h1>
          <p>
            The home page now routes directly into changing live pages, upcoming watch windows, and
            on-site short-form video instead of acting like a static section index.
          </p>
        </div>
        <div className="live-page-hero-rail">
          <div className="signal-panel signal-panel-accent">
            <span>Featured modules</span>
            <strong>{modules.data?.items.length ?? "..."}</strong>
          </div>
          <div className="signal-panel">
            <span>Live events</span>
            <strong>{liveEvents.data?.items.filter((item) => item.safeToPromote).length ?? "..."}</strong>
          </div>
          <div className="signal-panel">
            <span>Embedded shorts</span>
            <strong>{shorts.data?.items.length ?? "..."}</strong>
          </div>
        </div>
      </section>

      <section className="section-block">
        <div className="traffic-module-grid">
          {modules.loading
            ? Array.from({ length: 3 }).map((_, index) => (
                <article className="card card-skeleton traffic-module-card" key={`module-${index}`}>
                  <div className="skeleton-line skeleton-title" />
                  <div className="skeleton-line skeleton-copy" />
                </article>
              ))
            : null}
          {modules.error ? (
            <article className="card card-error">
              <p>Could not load the homepage modules.</p>
              <span>{modules.error}</span>
            </article>
          ) : null}
          {modules.data?.items.map((item) => (
            <HomeModuleCard item={item} key={item.id} />
          ))}
        </div>
      </section>

      <section className="section-block">
        <div className="section-header">
          <div>
            <p className="section-eyebrow">Watch Here</p>
            <h2>Shorts already mapped back into the site</h2>
          </div>
          <div className="section-meta">
            <p>These are the first two in-site playback cards. The full feed lives on the Video page.</p>
          </div>
        </div>
        <div className="home-short-preview-grid">
          {leadShorts.map((item) => (
            <article className="card home-short-preview" key={item.id}>
              <div className="short-card-player">
                <iframe
                  src={item.embedUrl}
                  title={item.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  loading="lazy"
                />
              </div>
              <div className="card-chip-row">
                <span className="chip chip-space">{item.relatedLabel}</span>
                <span className="muted">{item.source}</span>
              </div>
              <h3>{item.title}</h3>
              <p className="top-card-summary">{item.summary}</p>
              <div className="event-related-list">
                <Link className="event-related-link" to="/video">
                  Open full shorts feed
                </Link>
                <Link className="event-related-link" to={item.relatedPath}>
                  {item.relatedLabel}
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <LiveEventsSection
        eyebrow="Live"
        title="Events to watch"
        description="Continuous earth and space monitoring, plus scheduled watch windows that support repeat visits."
        updatedAt={liveEvents.data?.updatedAt}
        loading={liveEvents.loading}
        error={liveEvents.error}
        items={liveEvents.data?.items?.filter((item) => item.safeToPromote)}
        scores={liveScoreboard.data?.items}
        showPerformance
        limit={6}
      />

      <section className="section-block">
        <div className="section-header">
          <div>
            <p className="section-eyebrow">Support Surfaces</p>
            <h2>Games and gallery now exist to extend the session</h2>
          </div>
          <div className="section-meta">
            <p>They stay linked to live and video pages instead of competing with them for the site thesis.</p>
          </div>
        </div>
        <div className="section-hub-grid">
          <Link className="card section-hub-card section-hub-card-live" to="/live">
            <span className="chip chip-earth">Live</span>
            <h3>Open the live rail</h3>
            <p>Earthquake, aurora, launches, and the highest-signal event pages.</p>
          </Link>
          <Link className="card section-hub-card section-hub-card-video" to="/video">
            <span className="chip chip-space">Video</span>
            <h3>Watch the full shorts feed</h3>
            <p>Embedded YouTube clips that connect back into related events and topics.</p>
          </Link>
          <Link className="card section-hub-card section-hub-card-games" to="/games">
            <span className="chip chip-earth">Games</span>
            <h3>Play current-event games</h3>
            <p>Headline match, timeline sort, world quiz, rapid reaction, plus classic modes.</p>
          </Link>
          <Link className="card section-hub-card section-hub-card-gallery" to="/gallery">
            <span className="chip chip-space">Gallery</span>
            <h3>Browse visual explainers</h3>
            <p>Live visual collections for earthquakes, aurora, launch windows, and topic rotation.</p>
          </Link>
        </div>
      </section>
    </>
  );
}
