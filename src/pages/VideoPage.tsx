import { Seo } from "../components/Seo";
import { TopListSection } from "../components/TopListSection";
import { useContent } from "../hooks/useContent";
import { TopFeed } from "../types/content";

export function VideoPage() {
  const video = useContent<TopFeed>("/content/video/top.json");

  return (
    <>
      <Seo
        title="Video | XLB"
        description="A curated selection of videos worth watching now, from news and entertainment sources."
        path="/video"
      />
      <section className="static-hero">
        <p className="section-eyebrow">Video</p>
        <h1>Latest videos</h1>
        <p>
          Curated video content from trusted sources, selected for timely relevance and engaging storytelling.
        </p>
      </section>
      <TopListSection
        id="video"
        eyebrow="Video"
        title="Top videos"
        description="The most compelling videos from across news, sports, and entertainment, chosen for quick access and in-page playback when available."
        visualMode="video"
        expanded
        loading={video.loading}
        error={video.error}
        updatedAt={video.data?.updatedAt}
        items={video.data?.items}
      />
    </>
  );
}
