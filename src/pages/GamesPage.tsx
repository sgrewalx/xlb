import GamesSection from "../components/GamesSection";
import { Seo } from "../components/Seo";

export function GamesPage() {
  return (
    <>
      <Seo
        title="Games | XLB"
        description="Playable longer-form games including chess, go, and classic boards."
        path="/games"
      />
      <GamesSection />
    </>
  );
}
