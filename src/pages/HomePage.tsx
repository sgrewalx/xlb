import { Link } from "react-router-dom";
import { Seo } from "../components/Seo";
import { useContent } from "../hooks/useContent";
import { trackHomeLiveCardClick } from "../lib/analytics";
import { LiveEventsFeed } from "../types/content";

const FEATURED_VIDEO = {
  id: "homepage-featured-video",
  title: "Featured video",
  url: "https://www.youtube.com/watch?v=HfgIFGbdGJ0",
  embedUrl: "https://www.youtube.com/embed/HfgIFGbdGJ0?autoplay=1&mute=1&playsinline=1&rel=0",
};

export function HomePage() {
  const liveEvents = useContent<LiveEventsFeed>("/content/live/events.json", { refreshMs: 60000 });
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
    </>
  );
}
