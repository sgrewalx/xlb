import { useEffect } from "react";

interface SeoProps {
  title: string;
  description: string;
  path: string;
  robots?: "index,follow" | "noindex,follow";
}

export function Seo({ title, description, path, robots = "index,follow" }: SeoProps) {
  useEffect(() => {
    document.title = title;

    const descriptionTag = document.querySelector(
      'meta[name="description"]',
    ) as HTMLMetaElement | null;
    const robotsTag = document.querySelector(
      'meta[name="robots"]',
    ) as HTMLMetaElement | null;
    const canonicalTag = document.querySelector(
      'link[rel="canonical"]',
    ) as HTMLLinkElement | null;
    const ogTitleTag = document.querySelector(
      'meta[property="og:title"]',
    ) as HTMLMetaElement | null;
    const ogDescriptionTag = document.querySelector(
      'meta[property="og:description"]',
    ) as HTMLMetaElement | null;
    const ogUrlTag = document.querySelector(
      'meta[property="og:url"]',
    ) as HTMLMetaElement | null;
    const twitterTitleTag = document.querySelector(
      'meta[name="twitter:title"]',
    ) as HTMLMetaElement | null;
    const twitterDescriptionTag = document.querySelector(
      'meta[name="twitter:description"]',
    ) as HTMLMetaElement | null;

    if (descriptionTag) {
      descriptionTag.content = description;
    }

    if (robotsTag) {
      robotsTag.content = robots;
    }

    if (canonicalTag) {
      canonicalTag.href = `https://xlb.codemachine.in${path}`;
    }

    if (ogTitleTag) {
      ogTitleTag.content = title;
    }

    if (ogDescriptionTag) {
      ogDescriptionTag.content = description;
    }

    if (ogUrlTag) {
      ogUrlTag.content = `https://xlb.codemachine.in${path}`;
    }

    if (twitterTitleTag) {
      twitterTitleTag.content = title;
    }

    if (twitterDescriptionTag) {
      twitterDescriptionTag.content = description;
    }
  }, [description, path, robots, title]);

  return null;
}
