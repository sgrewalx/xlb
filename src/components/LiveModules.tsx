import { useContent } from "../hooks/useContent";

const USGS_EARTHQUAKE_FEED =
  "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson";

interface UsgsFeatureCollection {
  metadata?: {
    count?: number;
    generated?: number;
    url?: string;
  };
  features?: UsgsFeature[];
}

interface UsgsFeature {
  id: string;
  properties: {
    mag: number | null;
    place: string;
    time: number;
    title: string;
    url: string;
  };
  geometry?: {
    coordinates?: [number, number, number];
  };
}

function formatTimestamp(time?: number) {
  if (!time) {
    return "Pending";
  }

  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(new Date(time));
}

function formatMagnitude(value: number | null) {
  return value === null ? "--" : value.toFixed(1);
}

export function LiveModules() {
  const feed = useContent<UsgsFeatureCollection>(USGS_EARTHQUAKE_FEED);
  const features = [...(feed.data?.features ?? [])].sort(
    (left, right) => right.properties.time - left.properties.time,
  );

  const latest = features[0];
  const strongest = [...features].sort(
    (left, right) => (right.properties.mag ?? 0) - (left.properties.mag ?? 0),
  )[0];
  const visible = features.slice(0, 3);

  return (
    <section id="live-world" className="section-block">
      <div className="games-header live-world-header">
        <p className="section-eyebrow">Live world</p>
        <p className="games-mode-label">Earthquakes</p>
      </div>
      <div className="live-world-grid">
        {feed.loading ? (
          <article className="card card-skeleton earthquake-card">
            <div className="skeleton-line skeleton-tag" />
            <div className="skeleton-line skeleton-title" />
            <div className="skeleton-line skeleton-copy" />
          </article>
        ) : null}

        {feed.error ? (
          <article className="card card-error earthquake-card">
            <p>Earthquake feed unavailable.</p>
            <span>{feed.error}</span>
          </article>
        ) : null}

        {feed.data && !feed.loading && !feed.error ? (
          <article className="card earthquake-card">
            <div className="earthquake-stats">
              <div className="earthquake-stat">
                <span>24h count</span>
                <strong>{feed.data.metadata?.count ?? 0}</strong>
              </div>
              <div className="earthquake-stat">
                <span>Strongest</span>
                <strong>M {formatMagnitude(strongest?.properties.mag ?? null)}</strong>
              </div>
              <div className="earthquake-stat">
                <span>Latest</span>
                <strong>{formatTimestamp(latest?.properties.time)}</strong>
              </div>
            </div>

            <div className="earthquake-list">
              {visible.map((quake) => (
                <a
                  className="earthquake-row"
                  href={quake.properties.url}
                  key={quake.id}
                  rel="noreferrer"
                  target="_blank"
                >
                  <div className="earthquake-row-main">
                    <span className="earthquake-mag">
                      M {formatMagnitude(quake.properties.mag)}
                    </span>
                    <p>{quake.properties.place}</p>
                  </div>
                  <span className="earthquake-time">
                    {formatTimestamp(quake.properties.time)}
                  </span>
                </a>
              ))}
            </div>

            <div className="earthquake-footer">
              <p>
                Updated {formatTimestamp(feed.data.metadata?.generated)}. Directly
                from USGS 24-hour global activity.
              </p>
              <a
                className="ghost-button"
                href={feed.data.metadata?.url ?? "https://earthquake.usgs.gov/earthquakes/map/"}
                rel="noreferrer"
                target="_blank"
              >
                Open USGS feed
              </a>
            </div>
          </article>
        ) : null}
      </div>
    </section>
  );
}
