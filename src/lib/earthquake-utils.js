export const EARTHQUAKE_VISIT_KEY = "xlb:earthquake-intelligence:last-visit";

export function filterAndSortEarthquakes(events, filter, sort) {
  const minimumMagnitude = filter === "m5" ? 5 : filter === "m4" ? 4 : -Infinity;
  return events
    .filter((event) => event.magnitude >= minimumMagnitude)
    .sort((left, right) => {
      if (sort === "magnitude") {
        return right.magnitude - left.magnitude || Date.parse(right.occurredAt) - Date.parse(left.occurredAt);
      }
      if (sort === "depth") {
        return left.depthKm - right.depthKm || Date.parse(right.occurredAt) - Date.parse(left.occurredAt);
      }
      return Date.parse(right.occurredAt) - Date.parse(left.occurredAt);
    });
}

export function computeEarthquakeReturnDelta(events, previousVisit) {
  if (!previousVisit || !Array.isArray(previousVisit.eventIds) || !previousVisit.visitedAt) {
    return null;
  }
  const previousIds = new Set(previousVisit.eventIds);
  const newEvents = events.filter((event) => !previousIds.has(event.id));
  const strongestNew = [...newEvents].sort((left, right) => right.magnitude - left.magnitude)[0] ?? null;
  return {
    previousVisitAt: previousVisit.visitedAt,
    newCount: newEvents.length,
    newM4Plus: newEvents.filter((event) => event.magnitude >= 4).length,
    strongestNew,
  };
}

export function readEarthquakeVisit(storage, key = EARTHQUAKE_VISIT_KEY) {
  try {
    const parsed = JSON.parse(storage.getItem(key) ?? "null");
    return parsed && typeof parsed.visitedAt === "string" && Array.isArray(parsed.eventIds)
      ? { visitedAt: parsed.visitedAt, eventIds: parsed.eventIds.filter((id) => typeof id === "string").slice(0, 300) }
      : null;
  } catch {
    return null;
  }
}

export function writeEarthquakeVisit(storage, updatedAt, events, key = EARTHQUAKE_VISIT_KEY) {
  storage.setItem(key, JSON.stringify({
    visitedAt: updatedAt,
    eventIds: events.map((event) => event.id).slice(0, 300),
  }));
}

export function createEarthquakeVisitSession(
  storage,
  { key = EARTHQUAKE_VISIT_KEY, mountedAt = new Date().toISOString() } = {},
) {
  const priorVisitAtMount = readEarthquakeVisit(storage, key);
  let measured = false;
  let persisted = false;
  let delta = null;

  return {
    priorVisitAtMount,
    recordManifest(events) {
      let shouldTrack = false;
      let didPersist = false;

      if (!measured) {
        delta = computeEarthquakeReturnDelta(events, priorVisitAtMount);
        measured = true;
        shouldTrack = delta !== null;
      }

      if (!persisted) {
        writeEarthquakeVisit(storage, mountedAt, events, key);
        persisted = true;
        didPersist = true;
      }

      return { delta, shouldTrack, didPersist };
    },
  };
}
