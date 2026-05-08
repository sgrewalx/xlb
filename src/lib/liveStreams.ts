export type LiveStreamCategory = "space" | "earth";

export interface LiveStreamItem {
  id: string;
  title: string;
  provider: string;
  sourceUrl: string;
  embedUrl: string;
  note: string;
  categories: LiveStreamCategory[];
}

const AUTOPLAY_PARAMS = "autoplay=1&mute=1&playsinline=1&rel=0";

export const LIVE_STREAMS: LiveStreamItem[] = [
  {
    id: "earth-4k-space",
    title: "4K Earth from Space",
    provider: "Sen",
    sourceUrl: "https://www.sen.com/live",
    embedUrl: `https://www.youtube.com/embed/fO9e9jnhYK8?${AUTOPLAY_PARAMS}`,
    note: "Continuous 4K Earth views from cameras onboard the ISS.",
    categories: ["space"],
  },
  {
    id: "nasa-media",
    title: "NASA media channel",
    provider: "NASA TV",
    sourceUrl: "https://www.youtube.com/watch?v=sWDQrqxjWK4",
    embedUrl: `https://www.youtube.com/embed/sWDQrqxjWK4?${AUTOPLAY_PARAMS}`,
    note: "Official NASA media coverage and mission programming.",
    categories: ["space"],
  },
  {
    id: "starbase-live",
    title: "Starbase live",
    provider: "SpaceX Boca Chica",
    sourceUrl: "https://www.youtube.com/watch?v=mhJRzQsLZGg",
    embedUrl: `https://www.youtube.com/embed/mhJRzQsLZGg?${AUTOPLAY_PARAMS}`,
    note: "24/7 development feed from SpaceX Starbase.",
    categories: ["space"],
  },
  {
    id: "lax-airport",
    title: "LAX Airport live",
    provider: "Airline Videos",
    sourceUrl: "https://www.youtube.com/watch?v=9wRUrnqFo8A",
    embedUrl: `https://www.youtube.com/embed/9wRUrnqFo8A?${AUTOPLAY_PARAMS}`,
    note: "24/7 runway action at Los Angeles International Airport.",
    categories: ["earth"],
  },
  {
    id: "maho-airport",
    title: "Maho Beach / SXM",
    provider: "Princess Juliana Airport live",
    sourceUrl: "https://www.youtube.com/watch?v=iSeH45R-8R0",
    embedUrl: `https://www.youtube.com/embed/iSeH45R-8R0?${AUTOPLAY_PARAMS}`,
    note: "Low over-beach aircraft approaches at St. Maarten.",
    categories: ["earth"],
  },
  {
    id: "heathrow-airport",
    title: "Heathrow Airport live",
    provider: "Big Jet TV",
    sourceUrl: "https://www.youtube.com/watch?v=0qpz7aK55P0",
    embedUrl: `https://www.youtube.com/embed/0qpz7aK55P0?${AUTOPLAY_PARAMS}`,
    note: "Strong aviation feed with weather and traffic spikes.",
    categories: ["earth"],
  },
  {
    id: "times-square",
    title: "Times Square live",
    provider: "EarthCam",
    sourceUrl: "https://www.earthcam.com/usa/newyork/timessquare/",
    embedUrl: `https://www.youtube.com/embed/rnXIjl_Rzy4?${AUTOPLAY_PARAMS}`,
    note: "NYC street-level motion with a reliable always-on city feed.",
    categories: ["earth"],
  },
  {
    id: "shibuya",
    title: "Shibuya Crossing live",
    provider: "Tokyo live cam",
    sourceUrl: "https://www.youtube.com/watch?v=dfVK7ld38Ys",
    embedUrl: `https://www.youtube.com/embed/dfVK7ld38Ys?${AUTOPLAY_PARAMS}`,
    note: "High-traffic Tokyo crossing with constant street motion.",
    categories: ["earth"],
  },
  {
    id: "sydney-harbour",
    title: "Sydney Harbour live",
    provider: "WebcamSydney",
    sourceUrl: "https://www.youtube.com/watch?v=5uZa3-RMFos",
    embedUrl: `https://www.youtube.com/embed/5uZa3-RMFos?${AUTOPLAY_PARAMS}`,
    note: "Harbour traffic and skyline views in 24/7 rotation.",
    categories: ["earth"],
  },
  {
    id: "port-miami",
    title: "Port Miami live",
    provider: "PTZtv",
    sourceUrl: "https://www.youtube.com/watch?v=DxZziUUr6CY",
    embedUrl: `https://www.youtube.com/embed/DxZziUUr6CY?${AUTOPLAY_PARAMS}`,
    note: "Cruise and marine traffic with live harbor radio.",
    categories: ["earth"],
  },
  {
    id: "niagara-falls",
    title: "Niagara Falls live",
    provider: "Niagara live cam",
    sourceUrl: "https://www.youtube.com/watch?v=cf4YkyGk6Tk",
    embedUrl: `https://www.youtube.com/embed/cf4YkyGk6Tk?${AUTOPLAY_PARAMS}`,
    note: "Always-on waterfall view with strong ambient motion.",
    categories: ["earth"],
  },
  {
    id: "new-orleans",
    title: "New Orleans street live",
    provider: "EarthCam",
    sourceUrl: "https://www.youtube.com/watch?v=Ksrleaxxxhw",
    embedUrl: `https://www.youtube.com/embed/Ksrleaxxxhw?${AUTOPLAY_PARAMS}`,
    note: "Street-level New Orleans feed with constant city movement.",
    categories: ["earth"],
  },
  {
    id: "surf-cams",
    title: "Surf cams live",
    provider: "Global surf feed",
    sourceUrl: "https://www.youtube.com/watch?v=hm9iAviOZ20",
    embedUrl: `https://www.youtube.com/embed/hm9iAviOZ20?${AUTOPLAY_PARAMS}`,
    note: "Multi-coast surf cameras with changing wave conditions.",
    categories: ["earth"],
  },
  {
    id: "wildlife",
    title: "Live wildlife cams",
    provider: "explore.org",
    sourceUrl: "https://www.youtube.com/watch?v=Wq7JWmpzKyM",
    embedUrl: `https://www.youtube.com/embed/Wq7JWmpzKyM?${AUTOPLAY_PARAMS}`,
    note: "Always-on wildlife view from the Explore nature network.",
    categories: ["earth"],
  },
  {
    id: "african-waterhole",
    title: "African wildlife cam",
    provider: "Namib Desert",
    sourceUrl: "https://www.youtube.com/watch?v=ydYDqZQpim8",
    embedUrl: `https://www.youtube.com/embed/ydYDqZQpim8?${AUTOPLAY_PARAMS}`,
    note: "High-signal African waterhole stream with long passive watch time.",
    categories: ["earth"],
  },
];

export function getLiveStreams(category?: LiveStreamCategory) {
  if (!category) {
    return LIVE_STREAMS;
  }

  return LIVE_STREAMS.filter((item) => item.categories.includes(category));
}
