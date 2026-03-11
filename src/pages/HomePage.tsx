import { Suspense, lazy } from "react";
import { Hero } from "../components/Hero";
import { LiveModules } from "../components/LiveModules";
import { Seo } from "../components/Seo";
import { TopListSection } from "../components/TopListSection";
import { VisualFeed } from "../components/VisualFeed";
import { useContent } from "../hooks/useContent";
import { TopFeed } from "../types/content";

const GamesSection = lazy(() => import("../components/GamesSection"));

export function HomePage() {
  const xlb = useContent<TopFeed>("/content/xlb/top3.json");
  const news = useContent<TopFeed>("/content/news/top3.json");
  const sports = useContent<TopFeed>("/content/sports/top3.json");

  return (
    <>
      <Seo
        title="XLB | Live curiosity dashboard"
        description="Top 3 news, top 3 sports, quotes, visual feeds, games, and world-in-motion modules in one lightweight dashboard."
        path="/"
      />
      <Hero loading={xlb.loading} error={xlb.error} items={xlb.data?.items} />
      <Suspense
        fallback={
          <section className="section-block">
            <div className="card card-skeleton game-loading">
              <div className="skeleton-line skeleton-title" />
              <div className="skeleton-line skeleton-copy" />
            </div>
          </section>
        }
      >
        <GamesSection />
      </Suspense>
      <LiveModules />
      <VisualFeed />
      <TopListSection
        id="sports"
        eyebrow="Sports"
        headerTags={["Football", "Basketball", "Tennis", "Running", "Cricket"]}
        hideItemTags
        visualMode="sports"
        loading={sports.loading}
        error={sports.error}
        updatedAt={sports.data?.updatedAt}
        items={sports.data?.items}
      />
      <TopListSection
        id="news"
        eyebrow="News"
        headerTags={["Politics", "Climate", "Money"]}
        loading={news.loading}
        error={news.error}
        updatedAt={news.data?.updatedAt}
        items={news.data?.items}
      />
    </>
  );
}
