import { useEffect, useMemo, useState } from "react";
import { LiveEventItem } from "../types/content";

interface EarthquakeFeature {
  id: string;
  properties: {
    mag: number | null;
    place: string | null;
    time: number | null;
    url: string | null;
  };
}

interface EarthquakeResponse {
  features: EarthquakeFeature[];
}

type SpaceWeatherRow = [string, string, string, string] | string[];

type FeedState<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
};

function formatTime(value: number | string) {
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(new Date(value));
}

function useLiveJson<T>(url: string | null) {
  const [state, setState] = useState<FeedState<T>>({
    data: null,
    error: null,
    loading: Boolean(url),
  });

  useEffect(() => {
    if (!url) {
      setState({ data: null, error: null, loading: false });
      return undefined;
    }

    const controller = new AbortController();
    const feedUrl = url;

    async function load() {
      setState({ data: null, error: null, loading: true });

      try {
        const response = await fetch(feedUrl, {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Request failed with ${response.status}`);
        }

        const json = (await response.json()) as T;
        setState({ data: json, error: null, loading: false });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setState({
          data: null,
          error: error instanceof Error ? error.message : "Unknown live-feed error",
          loading: false,
        });
      }
    }

    void load();
    const timer = window.setInterval(load, 5 * 60 * 1000);

    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [url]);

  return state;
}

function EarthquakeLiveFeed() {
  const feed = useLiveJson<EarthquakeResponse>(
    "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson",
  );
  const events = useMemo(
    () =>
      [...(feed.data?.features ?? [])]
        .filter((feature) => feature.properties.time)
        .sort((left, right) => (right.properties.time ?? 0) - (left.properties.time ?? 0))
        .slice(0, 8),
    [feed.data],
  );
  const strongest = useMemo(
    () =>
      [...(feed.data?.features ?? [])].sort(
        (left, right) => (right.properties.mag ?? -1) - (left.properties.mag ?? -1),
      )[0] ?? null,
    [feed.data],
  );

  return (
    <div className="live-feed-panel">
      <div className="live-feed-summary">
        <div className="signal-panel signal-panel-accent">
          <span>Last 24h</span>
          <strong>{feed.data?.features.length ?? "..."}</strong>
        </div>
        <div className="signal-panel">
          <span>Strongest</span>
          <strong>{strongest ? `M${strongest.properties.mag ?? "?"}` : "..."}</strong>
        </div>
      </div>
      <div className="live-feed-list">
        {feed.loading ? <p className="muted">Loading live USGS events...</p> : null}
        {feed.error ? <p className="muted">Live USGS feed unavailable: {feed.error}</p> : null}
        {events.map((event) => (
          <a
            className="live-feed-row"
            href={event.properties.url ?? "https://earthquake.usgs.gov/earthquakes/map/"}
            key={event.id}
            rel="noreferrer"
            target="_blank"
          >
            <span>{event.properties.mag === null ? "M?" : `M${event.properties.mag.toFixed(1)}`}</span>
            <strong>{event.properties.place ?? "Location pending"}</strong>
            <time>{formatTime(event.properties.time ?? Date.now())}</time>
          </a>
        ))}
      </div>
    </div>
  );
}

function SpaceWeatherLiveFeed() {
  const feed = useLiveJson<SpaceWeatherRow[]>(
    "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json",
  );
  const rows = useMemo(() => (feed.data ?? []).slice(1).slice(-8).reverse(), [feed.data]);
  const latest = rows[0];

  return (
    <div className="live-feed-panel">
      <div className="live-feed-summary">
        <div className="signal-panel signal-panel-accent">
          <span>Current Kp</span>
          <strong>{latest?.[1] ?? "..."}</strong>
        </div>
        <div className="signal-panel">
          <span>Observed</span>
          <strong>{latest?.[0] ? formatTime(latest[0]) : "..."}</strong>
        </div>
      </div>
      <div className="live-feed-list">
        {feed.loading ? <p className="muted">Loading NOAA K-index observations...</p> : null}
        {feed.error ? <p className="muted">Live NOAA feed unavailable: {feed.error}</p> : null}
        {rows.map((row) => (
          <div className="live-feed-row" key={row[0]}>
            <span>Kp {row[1]}</span>
            <strong>{row[2] || "Geomagnetic observation"}</strong>
            <time>{formatTime(row[0])}</time>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LiveEventFeed({ item }: { item: LiveEventItem }) {
  const isEarthquakeFeed = item.topic === "earthquakes";
  const isSpaceWeatherFeed = item.topic === "space-weather";

  if (!isEarthquakeFeed && !isSpaceWeatherFeed) {
    return null;
  }

  return (
    <section className="section-block">
      <div className="live-feed-header">
        <div>
          <p className="section-eyebrow">Live Feed</p>
          <h2>{isEarthquakeFeed ? "Latest earthquakes" : "Current geomagnetic conditions"}</h2>
        </div>
        <a className="ghost-button button-secondary" href={item.sourceUrl} rel="noreferrer" target="_blank">
          Open source
        </a>
      </div>
      {isEarthquakeFeed ? <EarthquakeLiveFeed /> : <SpaceWeatherLiveFeed />}
    </section>
  );
}
