import { Seo } from "../components/Seo";
import { VisualFeed } from "../components/VisualFeed";

export function GalleryPage() {
  return (
    <>
      <Seo
        title="Gallery | XLB"
        description="A visual side of XLB with poster studies and image-led browsing."
        path="/gallery"
      />
      <section className="static-hero">
        <p className="section-eyebrow">Gallery</p>
        <h1>Poster studies and visual drift</h1>
        <p>
          A more playful side of XLB: graphic experiments, image-led browsing, and visual sets that
          make the site feel less purely informational.
        </p>
      </section>
      <VisualFeed />
    </>
  );
}
