import GamesSection from "../components/GamesSection";
import { SignalGamesSection } from "../components/SignalGamesSection";
import { Seo } from "../components/Seo";
import { useContent } from "../hooks/useContent";
import { GamesCatalogFeed } from "../types/content";

export function GamesPage() {
  const catalog = useContent<GamesCatalogFeed>("/content/games/catalog.json", { refreshMs: 60000 });

  return (
    <>
      <Seo
        title="Games | XLB"
        description="Current-event games plus classic modes, positioned as a retention layer that keeps visitors inside XLB longer."
        path="/games"
      />
      <section className="live-page-hero games-page-hero">
        <div className="live-page-hero-copy">
          <p className="section-eyebrow">Games</p>
          <h1>Games tied to the current site pulse</h1>
          <p>
            This section is no longer just Sudoku and Memory. It now includes current-event modes that
            pull from live pages, feeds, and topic routes, with the classic modes still available below.
          </p>
        </div>
        <div className="live-page-hero-rail">
          <div className="signal-panel signal-panel-accent">
            <span>Catalog items</span>
            <strong>{catalog.data?.items.length ?? "..."}</strong>
          </div>
          <div className="signal-panel">
            <span>Role</span>
            <strong>Retention</strong>
          </div>
          <div className="signal-panel">
            <span>Feed-linked</span>
            <strong>Yes</strong>
          </div>
        </div>
      </section>
      <SignalGamesSection items={catalog.data?.items} loading={catalog.loading} error={catalog.error} />
      <section className="section-block">
        <div className="section-header">
          <div>
            <p className="section-eyebrow">Classic Modes</p>
            <h2>Longer-form games still available</h2>
          </div>
          <div className="section-meta">
            <p>These support deeper sessions after the current-event modes have done their job.</p>
          </div>
        </div>
      </section>
      <GamesSection />
    </>
  );
}
