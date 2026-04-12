import { Seo } from "../components/Seo";
import { TopListSection } from "../components/TopListSection";
import { useContent } from "../hooks/useContent";
import { TopFeed } from "../types/content";

export function TechPage() {
  const tech = useContent<TopFeed>("/content/tech/top.json");

  return (
    <>
      <Seo
        title="Tech | XLB"
        description="A compact view of the latest technology news, products, and trends worth checking now."
        path="/tech"
      />
      <section className="static-hero">
        <p className="section-eyebrow">Tech</p>
        <h1>Latest technology news</h1>
        <p>
          A curated technology surface for the most important product launches, platform news, and industry shifts.
        </p>
      </section>
      <TopListSection
        id="tech"
        eyebrow="Tech"
        title="Top tech stories"
        description="The most relevant technology headlines, selected for source-first clarity and quick decision-making."
        expanded
        loading={tech.loading}
        error={tech.error}
        updatedAt={tech.data?.updatedAt}
        items={tech.data?.items}
      />
    </>
  );
}
