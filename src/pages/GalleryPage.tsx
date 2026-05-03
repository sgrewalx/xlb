import { GalleryCollections } from "../components/GalleryCollections";
import { Seo } from "../components/Seo";
import { useContent } from "../hooks/useContent";
import { GalleryCollectionsFeed } from "../types/content";

export function GalleryPage() {
  const gallery = useContent<GalleryCollectionsFeed>("/content/gallery/collections.json", {
    refreshMs: 60000,
  });

  return (
    <>
      <Seo
        title="Gallery | XLB"
        description="Live visual explainers built from current event and topic signals instead of static poster experiments."
        path="/gallery"
      />
      <section className="live-page-hero gallery-page-hero">
        <div className="live-page-hero-copy">
          <p className="section-eyebrow">Gallery</p>
          <h1>Live visuals, not a dead poster lab</h1>
          <p>
            The gallery now exists to explain current events visually and route people back into live pages,
            topic pages, and the embedded video feed.
          </p>
        </div>
        <div className="live-page-hero-rail">
          <div className="signal-panel signal-panel-accent">
            <span>Collections</span>
            <strong>{gallery.data?.items.length ?? "..."}</strong>
          </div>
          <div className="signal-panel">
            <span>Primary use</span>
            <strong>Retention</strong>
          </div>
          <div className="signal-panel">
            <span>Link depth</span>
            <strong>Live + Topic</strong>
          </div>
        </div>
      </section>
      <GalleryCollections
        items={gallery.data?.items}
        loading={gallery.loading}
        error={gallery.error}
        updatedAt={gallery.data?.updatedAt}
      />
    </>
  );
}
