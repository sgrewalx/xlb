import { Link } from "react-router-dom";
import { Hero } from "../components/Hero";
import { LiveEventsSection } from "../components/LiveEventsSection";
import { Seo } from "../components/Seo";
import { useContent } from "../hooks/useContent";
import { LiveEventsFeed, LiveEventScoreboard, TopFeed } from "../types/content";

export function HomePage() {
  const xlb = useContent<TopFeed>("/content/xlb/top3.json");
  const liveEvents = useContent<LiveEventsFeed>("/content/live/events.json");
  const liveScoreboard = useContent<LiveEventScoreboard>("/content/live/scoreboard.json");

  return (
    <>
      <Seo
        title="XLB | Live events worth checking"
        description="Source-backed live events across space and earth, with clear paths into event pages, topic pages, and focused sections."
        path="/"
      />
      <Hero
        loading={xlb.loading || liveEvents.loading}
        error={xlb.error ?? liveEvents.error}
        items={xlb.data?.items}
        liveItems={liveEvents.data?.items}
      />
      <LiveEventsSection
        eyebrow="Live"
        title="Events to watch"
        description="Fresh coverage across space and earth, chosen for repeat visits and real-world relevance."
        updatedAt={liveEvents.data?.updatedAt}
        loading={liveEvents.loading}
        error={liveEvents.error}
        items={liveEvents.data?.items?.filter((item) => item.safeToPromote)}
        scores={liveScoreboard.data?.items}
        limit={3}
      />
      <section className="section-block">
        <div className="section-header">
          <div>
            <p className="section-eyebrow">Explore</p>
            <h2>More ways into XLB</h2>
          </div>
          <div className="section-meta">
            <p>Use the homepage as a quick entry point, then move into the section that matches how you want to browse.</p>
          </div>
        </div>
        <div className="section-hub-grid">
          <Link className="card section-hub-card section-hub-card-live" to="/live">
            <span className="chip chip-earth">Live</span>
            <h3>Live events</h3>
            <p>Track what is happening now across space and earth without losing the thread.</p>
          </Link>
          <Link className="card section-hub-card section-hub-card-gallery" to="/gallery">
            <span className="chip chip-space">Gallery</span>
            <h3>Gallery</h3>
            <p>Browse poster studies, visual sets, and a more image-led side of the site.</p>
          </Link>
          <Link className="card section-hub-card section-hub-card-games" to="/games">
            <span className="chip chip-earth">Games</span>
            <h3>Games</h3>
            <p>Stay a little longer with a calmer, more playful corner of XLB.</p>
          </Link>
          <Link className="card section-hub-card section-hub-card-sports" to="/sports">
            <span className="chip chip-space">Sports</span>
            <h3>Sports</h3>
            <p>Quick access to the sports stories and fixtures worth opening right now.</p>
          </Link>
          <Link className="card section-hub-card section-hub-card-news" to="/news">
            <span className="chip chip-earth">News</span>
            <h3>News</h3>
            <p>A compact scan of timely stories without turning the homepage into a full news wall.</p>
          </Link>
        </div>
      </section>
    </>
  );
}
