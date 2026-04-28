import { Seo } from "../components/Seo";

interface StaticPageProps {
  title: string;
  description: string;
  path: string;
  robots?: "index,follow" | "noindex,follow";
  eyebrow: string;
  sections: Array<{
    heading: string;
    body: string;
  }>;
}

export function StaticPage({
  title,
  description,
  path,
  robots,
  eyebrow,
  sections,
}: StaticPageProps) {
  return (
    <>
      <Seo title={title} description={description} path={path} robots={robots} />
      <section className="static-hero">
        <p className="section-eyebrow">{eyebrow}</p>
        <h1>{title.replace(" | XLB", "")}</h1>
        {description ? <p>{description}</p> : null}
      </section>
      <section className="static-grid">
        {sections.map((section) => (
          <article className="card static-card" key={section.heading}>
            <h2>{section.heading}</h2>
            <p>{section.body}</p>
          </article>
        ))}
      </section>
    </>
  );
}
