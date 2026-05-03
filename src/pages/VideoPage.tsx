import { Seo } from "../components/Seo";
import { VideoShortFeed } from "../components/VideoShortFeed";
import { useContent } from "../hooks/useContent";
import { VideoShortsFeed } from "../types/content";

export function VideoPage() {
  const video = useContent<VideoShortsFeed>("/content/video/shorts.json", { refreshMs: 60000 });

  return (
    <>
      <Seo
        title="Video | XLB"
        description="Single-item short-form video viewer with reel-style up/down navigation."
        path="/video"
      />
      <VideoShortFeed
        items={video.data?.items}
        loading={video.loading}
        error={video.error}
        updatedAt={video.data?.updatedAt}
      />
    </>
  );
}
