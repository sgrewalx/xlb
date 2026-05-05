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
    id: "iss-earth",
    title: "Earth from ISS",
    provider: "NASA",
    sourceUrl: "https://www.nasa.gov/live",
    embedUrl: `https://www.youtube.com/embed/zPH5KtjJFaQ?${AUTOPLAY_PARAMS}`,
    note: "Official NASA ISS live views and station coverage.",
    categories: ["space"],
  },
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
    id: "venice",
    title: "Venice live cam",
    provider: "SkylineWebcams",
    sourceUrl: "https://www.skylinewebcams.com/en/webcam/italia/veneto/venezia/piazza-san-marco.html",
    embedUrl: `https://www.youtube.com/embed/x4AlaibltlA?${AUTOPLAY_PARAMS}`,
    note: "Piazza San Marco and the Venice waterfront in continuous view.",
    categories: ["earth"],
  },
  {
    id: "world-live",
    title: "Global live cams",
    provider: "earthTV",
    sourceUrl: "https://www.youtube.com/watch?v=HfgIFGbdGJ0",
    embedUrl: `https://www.youtube.com/embed/HfgIFGbdGJ0?${AUTOPLAY_PARAMS}`,
    note: "World-live rotation across major cities and landmarks.",
    categories: ["space", "earth"],
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
