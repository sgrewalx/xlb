import { useParams } from "react-router-dom";
import { LiveStreamSwitcher } from "../components/LiveStreamSwitcher";
import { Seo } from "../components/Seo";

export function LiveEventsPage() {
  const { category } = useParams();
  const selectedCategory = category === "space" || category === "earth" ? category : undefined;
  const description = selectedCategory === "space"
    ? "Watch space-focused live feeds and follow launches, NASA programming, aurora conditions, and space weather."
    : selectedCategory === "earth"
      ? "Watch Earth-focused live feeds and follow source-backed earthquake and world monitoring pages."
      : "Switch between current live video feeds and follow related space and Earth events without leaving XLB.";
  const title = selectedCategory === "space"
    ? "Live space | XLB"
    : selectedCategory === "earth"
      ? "Live Earth | XLB"
      : "Live | XLB";

  return (
    <>
      <Seo
        title={title}
        description={description}
        path={selectedCategory ? `/live/${selectedCategory}` : "/live"}
      />
      <LiveStreamSwitcher category={selectedCategory} />
    </>
  );
}
