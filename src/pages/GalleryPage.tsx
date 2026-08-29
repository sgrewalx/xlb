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
        description="Browse image-first visual explainers tied to current events, monitoring pages, and XLB topics."
        path="/gallery"
      />
      <GalleryCollections
        items={gallery.data?.items}
        loading={gallery.loading}
        error={gallery.error}
        updatedAt={gallery.data?.updatedAt}
      />
    </>
  );
}
