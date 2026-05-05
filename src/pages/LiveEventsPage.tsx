import { useParams } from "react-router-dom";
import { LiveStreamSwitcher } from "../components/LiveStreamSwitcher";
import { Seo } from "../components/Seo";

export function LiveEventsPage() {
  const { category } = useParams();
  const selectedCategory = category === "space" || category === "earth" ? category : undefined;

  return (
    <>
      <Seo
        title={selectedCategory ? `Live ${selectedCategory} | XLB` : "Live | XLB"}
        description="Switch between current live feeds without leaving XLB."
        path={selectedCategory ? `/live/${selectedCategory}` : "/live"}
      />
      <LiveStreamSwitcher category={selectedCategory} />
    </>
  );
}
