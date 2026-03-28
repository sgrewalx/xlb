import { Seo } from "../components/Seo";
import { TopListSection } from "../components/TopListSection";
import { useContent } from "../hooks/useContent";
import { TopFeed } from "../types/content";

export function NewsPage() {
  const news = useContent<TopFeed>("/content/news/top3.json");

  return (
    <>
      <Seo
        title="News | XLB"
        description="A tighter read on the world, with selected stories worth checking now."
        path="/news"
      />
      <section className="static-hero">
        <p className="section-eyebrow">News</p>
        <h1>Stories worth checking now</h1>
        <p>
          A compact read on the headlines that matter most right now, without turning the page into
          a general-purpose news dump.
        </p>
      </section>
      <TopListSection
        id="news"
        eyebrow="News"
        title="Top stories"
        description="A short list of timely stories with direct links to the original reporting."
        loading={news.loading}
        error={news.error}
        updatedAt={news.data?.updatedAt}
        items={news.data?.items}
      />
    </>
  );
}
