import { Suspense, lazy } from "react";
import { AdSlot } from "../components/AdSlot";
import { Hero } from "../components/Hero";
import { LiveModules } from "../components/LiveModules";
import { QuoteTicker } from "../components/QuoteTicker";
import { Seo } from "../components/Seo";
import { TopListSection } from "../components/TopListSection";
import { VisualFeed } from "../components/VisualFeed";
import { useContent } from "../hooks/useContent";
import {
  ModulesFeed,
  QuoteFeed,
  TopFeed,
  VisualFeed as VisualFeedType,
} from "../types/content";

const GamesSection = lazy(() => import("../components/GamesSection"));

export function HomePage() {
  const news = useContent<TopFeed>("/content/news/top3.json");
  const sports = useContent<TopFeed>("/content/sports/top3.json");
  const quotes = useContent<QuoteFeed>("/content/quotes/quotes.json");
  const visuals = useContent<VisualFeedType>("/content/visuals/feed.json");
  const modules = useContent<ModulesFeed>("/content/modules/modules.json");

  return (
    <>
      <Seo
        title="XLB | Live curiosity dashboard"
        description="Top 3 news, top 3 sports, quotes, visual feeds, games, and world-in-motion modules in one lightweight dashboard."
        path="/"
      />
      <Hero
        newsCount={news.data?.items.length ?? 0}
        sportsCount={sports.data?.items.length ?? 0}
        modulesCount={modules.data?.items.length ?? 0}
        visualsCount={visuals.data?.items.length ?? 0}
      />
      <AdSlot label="Hero sponsor slot" variant="banner" />
      <TopListSection
        id="news"
        eyebrow="Signals"
        title="Top 3 News"
        description="Just the headlines, source, and a clean exit. No heavy reading wall."
        loading={news.loading}
        error={news.error}
        updatedAt={news.data?.updatedAt}
        items={news.data?.items}
      />
      <TopListSection
        id="sports"
        eyebrow="Momentum"
        title="Top 3 Sports"
        description="Three quick stories to keep the scoreboard moving."
        loading={sports.loading}
        error={sports.error}
        updatedAt={sports.data?.updatedAt}
        items={sports.data?.items}
      />
      <LiveModules
        items={modules.data?.items}
        loading={modules.loading}
        error={modules.error}
        updatedAt={modules.data?.updatedAt}
      />
      <div className="two-up">
        <QuoteTicker
          items={quotes.data?.items}
          loading={quotes.loading}
          error={quotes.error}
          updatedAt={quotes.data?.updatedAt}
        />
        <div className="section-block">
          <AdSlot label="Inline module sponsor" />
        </div>
      </div>
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
      <VisualFeed
        items={visuals.data?.items}
        loading={visuals.loading}
        error={visuals.error}
        updatedAt={visuals.data?.updatedAt}
      />
    </>
  );
}
