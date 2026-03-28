import GamesSection from "../components/GamesSection";
import { Seo } from "../components/Seo";

export function GamesPage() {
  return (
    <>
      <Seo
        title="Games | XLB"
        description="Lightweight games designed to keep the site playful between information-heavy visits."
        path="/games"
      />
      <section className="static-hero">
        <p className="section-eyebrow">Games</p>
        <h1>A calmer corner of XLB</h1>
        <p>
          Lightweight games give the site a different tempo and create another reason to come back
          when you are not chasing a live update.
        </p>
      </section>
      <GamesSection />
    </>
  );
}
