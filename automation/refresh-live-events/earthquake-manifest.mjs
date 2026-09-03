export const USGS_DAILY_FEED_URL =
  "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson";
export const USGS_WEEKLY_FEED_URL =
  "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_EVENTS = 300;

export function normalizeUsgsEvent(feature) {
  const coordinates = feature?.geometry?.coordinates;
  const magnitude = Number(feature?.properties?.mag);
  const occurredAt = Number(feature?.properties?.time);
  const updatedAt = Number(feature?.properties?.updated);
  const longitude = Number(coordinates?.[0]);
  const latitude = Number(coordinates?.[1]);
  const depthKm = Number(coordinates?.[2]);
  const id = String(feature?.id ?? "").trim();
  const place = String(feature?.properties?.place ?? "").trim();
  const url = String(feature?.properties?.url ?? "").trim();

  if (
    !id ||
    !place ||
    !isHttpsUrl(url) ||
    !Number.isFinite(magnitude) ||
    !Number.isFinite(occurredAt) ||
    !Number.isFinite(longitude) ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(depthKm) ||
    longitude < -180 ||
    longitude > 180 ||
    latitude < -90 ||
    latitude > 90
  ) {
    return null;
  }

  const alert = String(feature?.properties?.alert ?? "").trim();
  const status = String(feature?.properties?.status ?? "").trim();
  const felt = toOptionalNonNegativeInteger(feature?.properties?.felt);
  const significance = toOptionalNonNegativeNumber(feature?.properties?.sig);

  return {
    id,
    magnitude: round(magnitude, 1),
    place,
    occurredAt: new Date(occurredAt).toISOString(),
    updatedAt: new Date(Number.isFinite(updatedAt) ? updatedAt : occurredAt).toISOString(),
    latitude: round(latitude, 4),
    longitude: round(longitude, 4),
    depthKm: round(depthKm, 1),
    tsunami: Number(feature?.properties?.tsunami) === 1,
    significance,
    felt,
    alert: alert || null,
    status: status || null,
    url,
  };
}

export function buildEarthquakeManifest({ currentFeed, weeklyFeed }) {
  const updatedTimestamp = Number(currentFeed?.metadata?.generated);
  if (!Number.isFinite(updatedTimestamp)) {
    throw new Error("USGS daily feed metadata.generated is missing or invalid");
  }

  const windowEnd = updatedTimestamp;
  const windowStart = windowEnd - DAY_MS;
  const currentEvents = normalizeFeed(currentFeed).filter((event) => {
    const occurredAt = Date.parse(event.occurredAt);
    return occurredAt >= windowStart && occurredAt <= windowEnd;
  });
  if (!currentEvents.length) {
    throw new Error("USGS daily feed returned no valid earthquake events");
  }

  const weeklyEvents = normalizeFeed(weeklyFeed);
  if (!weeklyEvents.length) {
    throw new Error("USGS weekly feed returned no valid earthquake events");
  }

  const baselineStart = windowEnd - 7 * DAY_MS;
  const baselineEvents = weeklyEvents.filter((event) => {
    const occurredAt = Date.parse(event.occurredAt);
    return occurredAt >= baselineStart && occurredAt < windowStart;
  });
  const currentSummary = summarizeEvents(currentEvents);
  const baselineSummary = summarizeEvents(baselineEvents);
  const baselineDays = 6;
  const dailyAverage = {
    total: round(baselineSummary.total / baselineDays, 1),
    m4Plus: round(baselineSummary.m4Plus / baselineDays, 1),
    m5Plus: round(baselineSummary.m5Plus / baselineDays, 1),
  };

  const manifest = {
    schemaVersion: 1,
    updatedAt: new Date(updatedTimestamp).toISOString(),
    source: {
      name: "USGS Earthquake Hazards Program",
      url: USGS_DAILY_FEED_URL,
      baselineUrl: USGS_WEEKLY_FEED_URL,
      window: "past-24-hours",
      baselineWindow: "previous-6-days",
    },
    summary: currentSummary,
    baseline: {
      days: baselineDays,
      dailyAverage,
      differenceFromAverage: {
        total: round(currentSummary.total - dailyAverage.total, 1),
        m4Plus: round(currentSummary.m4Plus - dailyAverage.m4Plus, 1),
        m5Plus: round(currentSummary.m5Plus - dailyAverage.m5Plus, 1),
      },
    },
    trends: {
      magnitudeBands: buildMagnitudeBands(currentEvents),
      threeHourBuckets: buildTimeBuckets(currentEvents, updatedTimestamp),
    },
    events: retainCurrentEvents(currentEvents, currentSummary.strongestEventId),
  };

  validateEarthquakeManifest(manifest);
  return manifest;
}

export function summarizeEvents(events) {
  const sortedByMagnitude = [...events].sort(compareStrongest);
  const strongest = sortedByMagnitude[0] ?? null;
  const depths = events.map((event) => event.depthKm).sort((left, right) => left - right);

  return {
    total: events.length,
    m4Plus: events.filter((event) => event.magnitude >= 4).length,
    m5Plus: events.filter((event) => event.magnitude >= 5).length,
    shallowCount: events.filter((event) => event.depthKm < 70).length,
    medianDepthKm: depths.length ? round(median(depths), 1) : null,
    strongestMagnitude: strongest?.magnitude ?? null,
    strongestEventId: strongest?.id ?? null,
  };
}

export function validateEarthquakeManifest(value) {
  assert(value && typeof value === "object", "earthquake manifest must be an object");
  assert(value.schemaVersion === 1, "earthquake manifest schemaVersion must be 1");
  assert(isIso(value.updatedAt), "earthquake manifest updatedAt must be an ISO date-time");
  assert(value.source?.name === "USGS Earthquake Hazards Program", "earthquake source name is invalid");
  assert(isHttpsUrl(value.source?.url), "earthquake source URL must be HTTPS");
  assert(isHttpsUrl(value.source?.baselineUrl), "earthquake baseline URL must be HTTPS");
  assert(value.source?.window === "past-24-hours", "earthquake source window is invalid");
  assert(value.source?.baselineWindow === "previous-6-days", "earthquake baseline window is invalid");
  validateSummary(value.summary, "summary", { allowEmpty: false });
  assert(value.baseline?.days === 6, "earthquake baseline days must be 6");
  for (const key of ["total", "m4Plus", "m5Plus"]) {
    assert(isNonNegativeNumber(value.baseline?.dailyAverage?.[key]), `earthquake baseline ${key} is invalid`);
    assert(Number.isFinite(value.baseline?.differenceFromAverage?.[key]), `earthquake difference ${key} is invalid`);
  }
  assert(Array.isArray(value.trends?.magnitudeBands) && value.trends.magnitudeBands.length === 4, "earthquake magnitude bands are invalid");
  assert(Array.isArray(value.trends?.threeHourBuckets) && value.trends.threeHourBuckets.length === 8, "earthquake time buckets are invalid");
  assert(Array.isArray(value.events) && value.events.length > 0, "earthquake events must not be empty");
  assert(value.events.length <= MAX_EVENTS, `earthquake events must not exceed ${MAX_EVENTS}`);

  const ids = new Set();
  value.events.forEach((event, index) => {
    assert(typeof event.id === "string" && event.id, `earthquake event ${index} id is invalid`);
    assert(!ids.has(event.id), `earthquake event ${index} id is duplicated`);
    ids.add(event.id);
    assert(Number.isFinite(event.magnitude), `earthquake event ${index} magnitude is invalid`);
    assert(typeof event.place === "string" && event.place, `earthquake event ${index} place is invalid`);
    assert(isIso(event.occurredAt), `earthquake event ${index} occurredAt is invalid`);
    assert(isIso(event.updatedAt), `earthquake event ${index} updatedAt is invalid`);
    assert(Number.isFinite(event.latitude) && event.latitude >= -90 && event.latitude <= 90, `earthquake event ${index} latitude is invalid`);
    assert(Number.isFinite(event.longitude) && event.longitude >= -180 && event.longitude <= 180, `earthquake event ${index} longitude is invalid`);
    assert(Number.isFinite(event.depthKm), `earthquake event ${index} depth is invalid`);
    assert(typeof event.tsunami === "boolean", `earthquake event ${index} tsunami is invalid`);
    assert(event.significance === null || isNonNegativeNumber(event.significance), `earthquake event ${index} significance is invalid`);
    assert(event.felt === null || Number.isInteger(event.felt) && event.felt >= 0, `earthquake event ${index} felt is invalid`);
    assert(event.alert === null || typeof event.alert === "string", `earthquake event ${index} alert is invalid`);
    assert(event.status === null || typeof event.status === "string", `earthquake event ${index} status is invalid`);
    assert(isHttpsUrl(event.url), `earthquake event ${index} URL is invalid`);
  });
  assert(value.events.every((event, index, items) => index === 0 || Date.parse(items[index - 1].occurredAt) >= Date.parse(event.occurredAt)), "earthquake events must be newest first");
  assert(value.summary.total >= value.events.length, "earthquake summary total cannot be smaller than retained events");
  assert(value.summary.strongestEventId === null || ids.has(value.summary.strongestEventId), "earthquake strongest event must be retained");
  assert(value.trends.magnitudeBands.reduce((sum, band) => sum + band.count, 0) === value.summary.total, "earthquake magnitude bands must reconcile with summary total");
  assert(value.trends.threeHourBuckets.reduce((sum, bucket) => sum + bucket.count, 0) === value.summary.total, "earthquake time buckets must reconcile with summary total");
  return value;
}

function normalizeFeed(feed) {
  const features = Array.isArray(feed?.features) ? feed.features : [];
  const byId = new Map();
  for (const feature of features) {
    const event = normalizeUsgsEvent(feature);
    if (event && !byId.has(event.id)) {
      byId.set(event.id, event);
    }
  }
  return [...byId.values()].sort((left, right) =>
    Date.parse(right.occurredAt) - Date.parse(left.occurredAt) || left.id.localeCompare(right.id),
  );
}

function validateSummary(summary, label, { allowEmpty }) {
  for (const key of ["total", "m4Plus", "m5Plus", "shallowCount"]) {
    assert(Number.isInteger(summary?.[key]) && summary[key] >= 0, `earthquake ${label} ${key} is invalid`);
  }
  if (!allowEmpty) {
    assert(summary.total > 0, `earthquake ${label} must not be empty`);
  }
  assert(summary.m4Plus >= summary.m5Plus, `earthquake ${label} magnitude counts are inconsistent`);
  assert(summary.total >= summary.m4Plus, `earthquake ${label} total is inconsistent`);
  assert(summary.medianDepthKm === null || Number.isFinite(summary.medianDepthKm), `earthquake ${label} median depth is invalid`);
  assert(summary.strongestMagnitude === null || Number.isFinite(summary.strongestMagnitude), `earthquake ${label} strongest magnitude is invalid`);
  assert(summary.strongestEventId === null || typeof summary.strongestEventId === "string", `earthquake ${label} strongest event is invalid`);
}

function buildMagnitudeBands(events) {
  const definitions = [
    { id: "under-3", label: "Below M3", matches: (magnitude) => magnitude < 3 },
    { id: "m3", label: "M3-3.9", matches: (magnitude) => magnitude >= 3 && magnitude < 4 },
    { id: "m4", label: "M4-4.9", matches: (magnitude) => magnitude >= 4 && magnitude < 5 },
    { id: "m5-plus", label: "M5+", matches: (magnitude) => magnitude >= 5 },
  ];
  return definitions.map(({ id, label, matches }) => ({
    id,
    label,
    count: events.filter((event) => matches(event.magnitude)).length,
  }));
}

function buildTimeBuckets(events, endTimestamp) {
  const bucketMs = 3 * 60 * 60 * 1000;
  const startTimestamp = endTimestamp - DAY_MS;
  return Array.from({ length: 8 }, (_, index) => {
    const start = startTimestamp + index * bucketMs;
    const end = start + bucketMs;
    return {
      start: new Date(start).toISOString(),
      end: new Date(end).toISOString(),
      count: events.filter((event) => {
        const occurredAt = Date.parse(event.occurredAt);
        return occurredAt >= start && (index === 7 ? occurredAt <= end : occurredAt < end);
      }).length,
    };
  });
}

function compareStrongest(left, right) {
  return right.magnitude - left.magnitude || Date.parse(right.occurredAt) - Date.parse(left.occurredAt) || left.id.localeCompare(right.id);
}

function retainCurrentEvents(events, strongestEventId) {
  const retained = events.slice(0, MAX_EVENTS);
  if (strongestEventId && !retained.some((event) => event.id === strongestEventId)) {
    retained[retained.length - 1] = events.find((event) => event.id === strongestEventId);
    retained.sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt) || left.id.localeCompare(right.id));
  }
  return retained;
}

function median(values) {
  const middle = Math.floor(values.length / 2);
  return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
}

function toOptionalNonNegativeInteger(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

function toOptionalNonNegativeNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function round(value, precision) {
  const factor = 10 ** precision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function isIso(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function isNonNegativeNumber(value) {
  return Number.isFinite(value) && value >= 0;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
