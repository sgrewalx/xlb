import { Seo } from "../components/Seo";
import { TopListSection } from "../components/TopListSection";
import { useContent } from "../hooks/useContent";
import { TopFeed } from "../types/content";

export function SportsPage() {
  const sports = useContent<TopFeed>("/content/sports/top3.json");

  return (
    <>
      <Seo
        title="Sports | XLB"
        description="A compact view of the sports stories and fixtures worth opening now."
        path="/sports"
      />
      <section className="static-hero">
        <p className="section-eyebrow">Sports</p>
        <h1>Fast-moving sports coverage</h1>
        <p>
          A focused sports surface for fixtures, major moments, and stories that reward quick check-ins.
        </p>
      </section>
      <TopListSection
        id="sports"
        eyebrow="Sports"
        title="Top sports picks"
        description="The strongest sports links and stories in one quick scan."
        headerTags={["Football", "Basketball", "Tennis", "Running", "Cricket"]}
        hideItemTags
        visualMode="sports"
        loading={sports.loading}
        error={sports.error}
        updatedAt={sports.data?.updatedAt}
        items={sports.data?.items}
      />
    </>
  );
}
