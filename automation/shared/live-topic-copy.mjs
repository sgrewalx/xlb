export function formatTopicTitle(value) {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (!normalized) {
    return "";
  }

  const replacements = new Map([
    ["nasa", "NASA"],
    ["usgs", "USGS"],
    ["noaa", "NOAA"],
    ["space-weather", "Space Weather"],
  ]);

  if (replacements.has(normalized)) {
    return replacements.get(normalized);
  }

  return normalized
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function summarizeTopic(items, scoreMap) {
  const events = Array.isArray(items) ? items : [];

  if (!events.length) {
    return "Source-backed monitoring for this topic is active, with fresh events added as they are validated.";
  }

  const topic = events[0]?.topic ?? "";
  const promoted = events.filter((item) => item.safeToPromote);
  const featured = pickFeaturedItem(events, scoreMap);
  const upcoming = [...events]
    .filter((item) => item.status === "upcoming")
    .sort((left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt));

  if (topic === "nasa") {
    return `${featured?.title ?? "NASA live programming"} anchors repeat-check coverage for NASA streams, mission updates, and major agency moments.`;
  }

  if (topic === "earthquakes") {
    return `${events[0]?.sourceName ?? "USGS"} keeps this topic current with source-backed global quake monitoring and rapid revisit value when seismic activity spikes.`;
  }

  if (topic === "launches") {
    const nextLaunch = upcoming[0];
    const nextLabel = nextLaunch ? formatShortDate(nextLaunch.startsAt) : "the next scheduled launch window";
    return `${promoted.length || events.length} source-backed launch page${events.length === 1 ? "" : "s"} are active here, led by ${nextLaunch?.title ?? featured?.title ?? "the next launch"} around ${nextLabel}.`;
  }

  if (topic === "space-weather") {
    return `${featured?.title ?? "Aurora watch"} keeps this topic focused on geomagnetic conditions, aurora potential, and recurring space-weather check-ins.`;
  }

  const statusLabels = [...new Set(events.map((item) => item.status))].join(", ");
  return `${formatTopicTitle(topic)} currently tracks ${events.length} source-backed event record${events.length === 1 ? "" : "s"} across ${statusLabels}.`;
}

function pickFeaturedItem(items, scoreMap) {
  const ranked = [...items].sort((left, right) => {
    const rightScore = scoreMap?.get?.(right.slug)?.score ?? 0;
    const leftScore = scoreMap?.get?.(left.slug)?.score ?? 0;

    if (rightScore !== leftScore) {
      return rightScore - leftScore;
    }

    return (right.heroPriority ?? 0) - (left.heroPriority ?? 0);
  });

  return ranked[0] ?? null;
}

function formatShortDate(value) {
  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    return "the upcoming window";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(timestamp));
}
