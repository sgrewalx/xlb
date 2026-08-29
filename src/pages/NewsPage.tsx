import { Seo } from "../components/Seo";
import { EditorialFeed } from "../components/EditorialFeed";
import { useContent } from "../hooks/useContent";
import { TopFeed } from "../types/content";

export function NewsPage() {
  const news = useContent<TopFeed>("/content/news/top.json");

  return (
    <>
      <Seo
        title="News | XLB"
        description="Scan selected current stories with concise context and direct links to original reporting."
        path="/news"
      />
      <EditorialFeed
        section="news"
        eyebrow="News"
        title="Stories shaping the day"
        description="A concise editorial digest with clear context, source attribution, and direct links to original reporting."
        loading={news.loading}
        error={news.error}
        updatedAt={news.data?.updatedAt}
        items={news.data?.items}
      />
    </>
  );
}
