import { Link, useParams } from "react-router-dom";
import { Seo } from "../components/Seo";
import { useContent } from "../hooks/useContent";
import { trackHomeLiveCardClick } from "../lib/analytics";
import { LiveEventsFeed } from "../types/content";

const LIVE_VIDEO = {
  title: "NASA live",
  url: "https://www.nasa.gov/live",
  embedUrl: "https://www.youtube.com/embed/21X5lGlDOfg?autoplay=1&mute=1&playsinline=1&rel=0",
};

export function LiveEventsPage() {
  const { category } = useParams();
  const feed = useContent<LiveEventsFeed>("/content/live/events.json", { refreshMs: 60000 });

  const selectedCategory =
    category === "space" || category === "earth" ? category : undefined;
  const featuredItems = (feed.data?.items ?? []).filter((item) => {
    if (selectedCategory) {
      return item.category === selectedCategory;
    }
    return ["aurora-watch", "global-earthquake-watch", "nasa-live-programming"].includes(item.slug);
  }).slice(0, 3);

  return (
    <>
      <Seo
        title={selectedCategory ? `Live ${selectedCategory} | XLB` : "Live | XLB"}
        description="Live stream and direct links into active pages."
        path={selectedCategory ? `/live/${selectedCategory}` : "/live"}
      />
      <section className="live-page-hero home-traffic-hero">
        <div className="live-page-hero-copy">
          <div className="hero-pill-row">
            <span className="chip chip-space">Live Now</span>
            {featuredItems.map((item) => (
              <Link
                className="hero-pill-link"
                key={item.id}
                onClick={() => trackHomeLiveCardClick("live-now", `/events/${item.slug}`)}
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
              src={LIVE_VIDEO.embedUrl}
              title={LIVE_VIDEO.title}
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
