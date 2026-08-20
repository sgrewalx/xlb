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
        description="Watch one short-form video at a time in XLB's reel-style viewer."
        path="/video"
      />
      <VideoShortFeed
        items={video.data?.items}
        loading={video.loading}
        error={video.error}
      />
    </>
  );
}
