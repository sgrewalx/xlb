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
        description="A vertical, mobile-first short-form video feed with embedded YouTube playback and direct links back into related live pages."
        path="/video"
      />
      <section className="live-page-hero video-page-hero">
        <div className="live-page-hero-copy">
          <p className="section-eyebrow">Video</p>
          <h1>Watch the feed without leaving XLB</h1>
          <p>
            This page now prioritizes embedded, vertical short-form playback. Every card should send you
            deeper into a live event, topic, or source-backed section instead of ending the session.
          </p>
        </div>
        <div className="live-page-hero-rail">
          <div className="signal-panel signal-panel-accent">
            <span>Shorts in feed</span>
            <strong>{video.data?.items.length ?? "..."}</strong>
          </div>
          <div className="signal-panel">
            <span>Primary source</span>
            <strong>YouTube</strong>
          </div>
          <div className="signal-panel">
            <span>Mode</span>
            <strong>In-site playback</strong>
          </div>
        </div>
      </section>
      <VideoShortFeed
        items={video.data?.items}
        loading={video.loading}
        error={video.error}
        updatedAt={video.data?.updatedAt}
      />
    </>
  );
}
