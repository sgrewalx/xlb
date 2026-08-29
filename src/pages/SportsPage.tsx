import { Seo } from "../components/Seo";
import { EditorialFeed } from "../components/EditorialFeed";
import { useContent } from "../hooks/useContent";
import { TopFeed } from "../types/content";

export function SportsPage() {
  const sports = useContent<TopFeed>("/content/sports/top.json");

  return (
    <>
      <Seo
        title="Sports | XLB"
        description="Scan selected sports stories, fixtures, and major moments with direct links to their original sources."
        path="/sports"
      />
      <EditorialFeed
        section="sports"
        eyebrow="Sports"
        title="The action now"
        description="Fast-moving stories, defining moments, and the latest talking points from across sport."
        loading={sports.loading}
        error={sports.error}
        updatedAt={sports.data?.updatedAt}
        items={sports.data?.items}
      />
    </>
  );
}
