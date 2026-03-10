import { useEffect } from "react";

interface SeoProps {
  title: string;
  description: string;
  path: string;
}

export function Seo({ title, description, path }: SeoProps) {
  useEffect(() => {
    document.title = title;

    const descriptionTag = document.querySelector(
      'meta[name="description"]',
    ) as HTMLMetaElement | null;
    const canonicalTag = document.querySelector(
      'link[rel="canonical"]',
    ) as HTMLLinkElement | null;

    if (descriptionTag) {
      descriptionTag.content = description;
    }

    if (canonicalTag) {
      canonicalTag.href = `https://xlb.codemachine.in${path}`;
    }
  }, [description, path, title]);

  return null;
}
