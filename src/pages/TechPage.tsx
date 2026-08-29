import { Seo } from "../components/Seo";
import { EditorialFeed } from "../components/EditorialFeed";
import { useContent } from "../hooks/useContent";
import { TopFeed } from "../types/content";

export function TechPage() {
  const tech = useContent<TopFeed>("/content/tech/top.json");

  return (
    <>
      <Seo
        title="Tech | XLB"
        description="Scan selected technology news, product updates, and industry shifts with direct source links."
        path="/tech"
      />
      <EditorialFeed
        section="tech"
        eyebrow="Tech"
        title="Technology, right now"
        description="Fresh reporting on AI, devices, startups, security, policy, and the platforms changing daily life."
        loading={tech.loading}
        error={tech.error}
        updatedAt={tech.data?.updatedAt}
        items={tech.data?.items}
      />
    </>
  );
}
