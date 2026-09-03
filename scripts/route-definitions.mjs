export const SITE_ORIGIN = "https://xlb.codemachine.in";

const staticRoutes = [
  {
    path: "/",
    title: "XLB | Watch now",
    description: "Watch live events and video, then move quickly into the most active pages on XLB.",
    eyebrow: "Watch now",
    h1: "Watch the world live",
    intro: "Start with a live view, then follow the events and topics changing now.",
    kind: "home",
    ogType: "website",
    imagePath: "/og-image.svg",
    links: [
      { label: "Open live streams", href: "/live" },
      { label: "Watch short videos", href: "/video" },
      { label: "Explore live visuals", href: "/gallery" },
    ],
  },
  {
    path: "/about",
    title: "About | XLB",
    description: "How XLB presents source-backed live events, public-interest monitoring, and watch destinations.",
    eyebrow: "About",
    h1: "About XLB",
    intro: "XLB is a compact destination for watching and following public-interest moments across space and Earth.",
    kind: "webpage",
    ogType: "website",
    imagePath: "/og-image.svg",
    links: [
      { label: "See what is live", href: "/live" },
      { label: "Browse current topics", href: "/topics/space-weather" },
      { label: "Contact XLB", href: "/contact" },
    ],
  },
  {
    path: "/privacy",
    title: "Privacy | XLB",
    description: "Read XLB's current privacy and data-handling approach.",
    eyebrow: "Privacy",
    h1: "Privacy",
    intro: "XLB currently has no account system and aims to keep data collection limited to operating and improving the site.",
    kind: "webpage",
    ogType: "website",
    imagePath: "/og-image.svg",
    links: [
      { label: "Read the terms", href: "/terms" },
      { label: "Contact XLB", href: "/contact" },
      { label: "Return home", href: "/" },
    ],
  },
  {
    path: "/terms",
    title: "Terms | XLB",
    description: "Terms for using XLB's informational, entertainment, and source-linked pages.",
    eyebrow: "Terms",
    h1: "Terms",
    intro: "XLB is an informational and entertainment site whose feed-driven pages and external sources can change over time.",
    kind: "webpage",
    ogType: "website",
    imagePath: "/og-image.svg",
    links: [
      { label: "Read the privacy page", href: "/privacy" },
      { label: "Contact XLB", href: "/contact" },
      { label: "Return home", href: "/" },
    ],
  },
  {
    path: "/contact",
    title: "Contact | XLB",
    description: "Contact XLB about platform feedback, broken feeds, safety concerns, or content questions.",
    eyebrow: "Contact",
    h1: "Contact XLB",
    intro: "Use the published contact channel for product feedback, content questions, broken feeds, or safety reports.",
    kind: "webpage",
    ogType: "website",
    imagePath: "/og-image.svg",
    links: [
      { label: "Learn about XLB", href: "/about" },
      { label: "Read the privacy page", href: "/privacy" },
      { label: "Return home", href: "/" },
    ],
  },
  {
    path: "/advertise",
    title: "Advertise | XLB",
    description: "Advertising principles and potential sponsor formats for XLB.",
    eyebrow: "Advertise",
    h1: "Advertise on XLB",
    intro: "XLB's advertising approach favors clearly labeled, lightweight placements that do not interrupt viewing or navigation.",
    kind: "webpage",
    ogType: "website",
    imagePath: "/og-image.svg",
    links: [
      { label: "Contact XLB", href: "/contact" },
      { label: "Learn about XLB", href: "/about" },
      { label: "Return home", href: "/" },
    ],
  },
  {
    path: "/live",
    title: "Live | XLB",
    description: "Switch between current live video feeds and follow related space and Earth events without leaving XLB.",
    eyebrow: "Live now",
    h1: "Live streams",
    intro: "Choose a live feed, then open the related event and topic pages for current context.",
    kind: "collection",
    ogType: "website",
    imagePath: "/og-image.svg",
    links: [
      { label: "Live space", href: "/live/space" },
      { label: "Live Earth", href: "/live/earth" },
      { label: "Watch short videos", href: "/video" },
    ],
  },
  {
    path: "/live/space",
    title: "Live space | XLB",
    description: "Watch space-focused live feeds and follow launches, NASA programming, aurora conditions, and space weather.",
    eyebrow: "Live space",
    h1: "Space live streams",
    intro: "Watch space feeds and move into source-backed pages for launches, NASA programming, aurora conditions, and space weather.",
    kind: "collection",
    ogType: "website",
    imagePath: "/media/modules/satellites.svg",
    links: [
      { label: "All live streams", href: "/live" },
      { label: "Aurora watch", href: "/events/aurora-watch" },
      { label: "Space weather topic", href: "/topics/space-weather" },
    ],
  },
  {
    path: "/live/earth",
    title: "Live Earth | XLB",
    description: "Watch Earth-focused live feeds and follow source-backed earthquake and world monitoring pages.",
    eyebrow: "Live Earth",
    h1: "Earth live streams",
    intro: "Watch Earth feeds and move into current monitoring pages for earthquakes and other public-interest signals.",
    kind: "collection",
    ogType: "website",
    imagePath: "/media/modules/earthquakes.svg",
    links: [
      { label: "All live streams", href: "/live" },
      { label: "Global earthquake watch", href: "/events/global-earthquake-watch" },
      { label: "Earthquakes topic", href: "/topics/earthquakes" },
    ],
  },
  {
    path: "/games",
    title: "Games | XLB",
    description: "Play longer-form games on XLB, including chess, go, puzzles, and classic boards.",
    eyebrow: "Games",
    h1: "Play a longer game",
    intro: "Choose a replayable board or puzzle game, then return to the live and current-content surfaces.",
    kind: "collection",
    ogType: "website",
    imagePath: "/media/visuals/studio-sprint.svg",
    links: [
      { label: "See what is live", href: "/live" },
      { label: "Browse the gallery", href: "/gallery" },
      { label: "Read current news", href: "/news" },
    ],
  },
  {
    path: "/gallery",
    title: "Gallery | XLB",
    description: "Browse image-first visual explainers tied to current events, monitoring pages, and XLB topics.",
    eyebrow: "Gallery",
    h1: "The world in signals",
    intro: "Browse visual snapshots from the live events and topics changing now, then continue into their source-backed pages.",
    kind: "collection",
    ogType: "website",
    imagePath: "/media/visuals/tokyo-midnight.svg",
    links: [
      { label: "Global earthquake watch", href: "/events/global-earthquake-watch" },
      { label: "Aurora watch", href: "/events/aurora-watch" },
      { label: "Browse live streams", href: "/live" },
    ],
  },
  {
    path: "/sports",
    title: "Sports | XLB",
    description: "Scan selected sports stories, fixtures, and major moments with direct links to their original sources.",
    eyebrow: "Sports",
    h1: "The action now",
    intro: "Fast-moving stories, defining moments, and the latest talking points from across sport.",
    kind: "collection",
    ogType: "website",
    imagePath: "/media/sports/football.svg",
    links: [
      { label: "Read current news", href: "/news" },
      { label: "Watch short videos", href: "/video" },
      { label: "Play games", href: "/games" },
    ],
  },
  {
    path: "/news",
    title: "News | XLB",
    description: "Scan selected current stories with concise context and direct links to original reporting.",
    eyebrow: "News",
    h1: "Stories shaping the day",
    intro: "A concise editorial digest with clear context, source attribution, and direct links to original reporting.",
    kind: "collection",
    ogType: "website",
    imagePath: "/og-image.svg",
    links: [
      { label: "See what is live", href: "/live" },
      { label: "Read technology stories", href: "/tech" },
      { label: "Watch short videos", href: "/video" },
    ],
  },
  {
    path: "/tech",
    title: "Tech | XLB",
    description: "Scan selected technology news, product updates, and industry shifts with direct source links.",
    eyebrow: "Technology",
    h1: "Technology, right now",
    intro: "Fresh reporting on AI, devices, startups, security, policy, and the platforms changing daily life.",
    kind: "collection",
    ogType: "website",
    imagePath: "/media/modules/satellites.svg",
    links: [
      { label: "Read current news", href: "/news" },
      { label: "See what is live", href: "/live" },
      { label: "Watch short videos", href: "/video" },
    ],
  },
  {
    path: "/video",
    title: "Video | XLB",
    description: "Watch one short-form video at a time in XLB's reel-style viewer.",
    eyebrow: "Video",
    h1: "Watch one video at a time",
    intro: "Move through the short-form video queue, then continue into related live, topic, or news pages.",
    kind: "collection",
    ogType: "website",
    imagePath: "/og-image.svg",
    links: [
      { label: "Browse live streams", href: "/live" },
      { label: "Read current news", href: "/news" },
      { label: "Explore the gallery", href: "/gallery" },
    ],
  },
];

export function buildRouteDefinitions({ eventsFeed, topicsFeed }) {
  const events = Array.isArray(eventsFeed?.items) ? eventsFeed.items : [];
  const topics = Array.isArray(topicsFeed?.items) ? topicsFeed.items : [];

  const eventRoutes = events.map((event) => {
    const isEarthquakeIntelligence = event.slug === "global-earthquake-watch";
    return {
      path: `/events/${event.slug}`,
      title: isEarthquakeIntelligence
        ? "Live Earthquake Map: Recent Global Earthquakes | XLB"
        : `${event.title} | XLB`,
      description: isEarthquakeIntelligence
        ? "Explore the latest global earthquakes on a live map with USGS-backed magnitude, depth, location, timing, and recent activity context."
        : cleanDescription(event.summary),
      eyebrow: isEarthquakeIntelligence
        ? "USGS live data"
        : event.status === "live" ? "Live now" : `${titleCase(event.status)} event`,
      h1: isEarthquakeIntelligence ? "Live Earthquake Map" : event.title,
      intro: isEarthquakeIntelligence
        ? "Explore recent earthquake locations, magnitude, depth, and 24-hour activity using authoritative USGS data refreshed through XLB's publishing pipeline."
        : event.summary,
      staticDetails: isEarthquakeIntelligence ? [
        "Compare current 24-hour earthquake activity with the daily average from the previous six days.",
        "Filter recent events by magnitude and open each record at the USGS source.",
        "This activity page does not predict earthquakes or provide a danger assessment.",
      ] : [],
      dataset: isEarthquakeIntelligence ? {
        name: "XLB recent global earthquake snapshot",
        description: "A daily generated view of recent global earthquake locations, magnitude, depth, and activity context sourced from USGS GeoJSON feeds.",
        contentUrl: "/content/earthquakes/current.json",
        temporalCoverage: "P1D",
        spatialCoverage: "Global",
      } : null,
      kind: "event",
      ogType: "article",
      imagePath: event.category === "earth"
        ? "/media/modules/earthquakes.svg"
        : "/media/modules/satellites.svg",
      updatedAt: event.updatedAt ?? eventsFeed?.updatedAt,
      sourceName: event.sourceName,
      category: event.category,
      topic: event.topic,
      links: [
        { label: `${titleCase(event.topic)} topic`, href: `/topics/${event.topic}` },
        { label: `Live ${event.category}`, href: `/live/${event.category}` },
        { label: "All live streams", href: "/live" },
        ...events
          .filter((candidate) => candidate.slug !== event.slug && candidate.category === event.category)
          .slice(0, 2)
          .map((candidate) => ({
            label: candidate.title,
            href: `/events/${candidate.slug}`,
          })),
      ],
    };
  });

  const topicRoutes = topics.map((topic) => {
    const relatedEvents = events.filter((event) => event.topic === topic.slug);

    return {
      path: `/topics/${topic.slug}`,
      title: `${topic.title} | XLB`,
      description: cleanDescription(topic.summary),
      eyebrow: `${titleCase(topic.category)} topic`,
      h1: topic.title,
      intro: topic.summary,
      kind: "topic",
      ogType: "article",
      imagePath: topic.category === "earth"
        ? "/media/modules/earthquakes.svg"
        : "/media/modules/satellites.svg",
      updatedAt: topic.updatedAt ?? topicsFeed?.updatedAt,
      category: topic.category,
      links: [
        { label: `Live ${topic.category}`, href: `/live/${topic.category}` },
        { label: "All live streams", href: "/live" },
        ...relatedEvents.map((event) => ({
          label: event.title,
          href: `/events/${event.slug}`,
        })),
      ],
    };
  });

  const routes = [
    ...staticRoutes.map((route) => ({ ...route, links: [...route.links] })),
    ...eventRoutes,
    ...topicRoutes,
  ];
  const routePaths = new Set(routes.map((route) => route.path));

  const featuredEventLinks = events
    .filter((event) => [
      "global-earthquake-watch",
      "aurora-watch",
      "nasa-live-programming",
    ].includes(event.slug))
    .map((event) => ({ label: event.title, href: `/events/${event.slug}` }));

  const home = routes.find((route) => route.path === "/");
  const live = routes.find((route) => route.path === "/live");
  if (home) {
    home.links.push(...featuredEventLinks);
  }
  if (live) {
    live.links.push(...events.map((event) => ({
      label: event.title,
      href: `/events/${event.slug}`,
    })));
  }

  for (const route of routes) {
    route.links = deduplicateLinks(route.links)
      .filter((link) => routePaths.has(link.href));
  }

  return routes;
}

export function extractSitemapRoutes(xml) {
  const matches = [...xml.matchAll(/<loc>https:\/\/xlb\.codemachine\.in([^<]*)<\/loc>/g)];
  return [...new Set(matches.map((match) => match[1] || "/"))];
}

export function canonicalUrl(path) {
  return `${SITE_ORIGIN}${path}`;
}

function cleanDescription(value) {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim();
  if (normalized.length <= 180) {
    return normalized;
  }
  return `${normalized.slice(0, 177).trimEnd()}...`;
}

function deduplicateLinks(links) {
  const seen = new Set();
  return links.filter((link) => {
    if (!link?.href || !link?.label || seen.has(link.href)) {
      return false;
    }
    seen.add(link.href);
    return true;
  });
}

function titleCase(value) {
  return String(value ?? "")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
