import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Seo } from "./Seo";
import { useContent } from "../hooks/useContent";
import {
  trackEarthquakeEventOpen,
  trackEarthquakeFilterChange,
  trackEarthquakeMapInteraction,
  trackEarthquakeReturnDeltaView,
  trackEarthquakeUsgsClick,
} from "../lib/analytics";
import {
  createEarthquakeVisitSession,
  filterAndSortEarthquakes,
} from "../lib/earthquake-utils.js";
import type {
  EarthquakeEvent,
  EarthquakeManifest,
  LiveEventItem,
} from "../types/content";
import type {
  EarthquakeFilter,
  EarthquakeReturnDelta,
  EarthquakeSort,
} from "../lib/earthquake-utils.js";

const PAGE_PATH = "/events/global-earthquake-watch";

export function EarthquakeIntelligence({ item }: { item: LiveEventItem }) {
  const feed = useContent<EarthquakeManifest>("/content/earthquakes/current.json", { refreshMs: 15 * 60 * 1000 });
  const [filter, setFilter] = useState<EarthquakeFilter>("all");
  const [sort, setSort] = useState<EarthquakeSort>("newest");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [returnDelta, setReturnDelta] = useState<EarthquakeReturnDelta | null>(null);
  const visitSession = useRef<ReturnType<typeof createEarthquakeVisitSession> | null>(null);
  if (visitSession.current === null && typeof window !== "undefined") {
    visitSession.current = createEarthquakeVisitSession(window.localStorage);
  }
  const data = feed.data;

  useEffect(() => {
    if (!data || !visitSession.current) return;
    const measurement = visitSession.current.recordManifest(data.events);
    setReturnDelta(measurement.delta);
    if (measurement.shouldTrack && measurement.delta) {
      trackEarthquakeReturnDeltaView(measurement.delta.newCount, measurement.delta.newM4Plus);
    }
  }, [data]);

  const events = useMemo(
    () => data ? filterAndSortEarthquakes([...data.events], filter, sort) : [],
    [data, filter, sort],
  );
  const selected = data?.events.find((event) => event.id === selectedId)
    ?? data?.events.find((event) => event.id === data.summary.strongestEventId)
    ?? data?.events[0];

  function selectFromMap(event: EarthquakeEvent, position: number) {
    setSelectedId(event.id);
    trackEarthquakeMapInteraction(event.id, event.magnitude, position);
  }

  function changeFilter(nextFilter: EarthquakeFilter) {
    setFilter(nextFilter);
    trackEarthquakeFilterChange(nextFilter);
  }

  return (
    <>
      <Seo
        title="Live Earthquake Map: Recent Global Earthquakes | XLB"
        description="Explore the latest global earthquakes on a live map with USGS-backed magnitude, depth, location, timing, and recent activity context."
        path={PAGE_PATH}
      />

      <section className="quake-hero">
        <div>
          <p className="section-eyebrow">USGS live data</p>
          <h1>Live Earthquake Map</h1>
          <p className="quake-lede">
            Recent global earthquakes, their magnitude, depth, and location. Data comes from the
            USGS Earthquake Hazards Program and refreshes through XLB&apos;s daily publishing pipeline.
          </p>
        </div>
        <div className="quake-source-meta">
          <span>Latest snapshot</span>
          <strong>{data ? formatUpdated(data.updatedAt) : "Loading"}</strong>
          <a href={item.sourceUrl} target="_blank" rel="noreferrer">USGS source</a>
        </div>
      </section>

      {feed.loading && !data ? <EarthquakeSkeleton /> : null}
      {feed.error && !data ? (
        <section className="quake-state" role="alert">
          <strong>Earthquake snapshot unavailable</strong>
          <p>The last published data could not be loaded. Try again shortly or open the USGS source.</p>
          <a href={item.sourceUrl} target="_blank" rel="noreferrer">Open USGS</a>
        </section>
      ) : null}

      {data ? (
        <>
          <section className="quake-stat-grid" aria-label="Current earthquake activity summary">
            <Metric label="Events in 24h" value={String(data.summary.total)} />
            <Metric label="M4 or stronger" value={String(data.summary.m4Plus)} tone="blue" />
            <Metric label="Strongest" value={formatMagnitude(data.summary.strongestMagnitude)} tone="warm" />
            <Metric
              label="Vs recent daily average"
              value={formatDifference(data.baseline.differenceFromAverage.total)}
              detail={`${data.baseline.dailyAverage.total} events/day over the previous 6 days`}
            />
          </section>

          {returnDelta ? <ReturnDelta delta={returnDelta} /> : null}

          <section className="quake-map-section" aria-labelledby="quake-map-title">
            <div className="quake-section-heading">
              <div>
                <p className="section-eyebrow">Past 24 hours</p>
                <h2 id="quake-map-title">Where earthquakes happened</h2>
              </div>
              <button
                className="quake-strongest-button"
                type="button"
                onClick={() => data.summary.strongestEventId && setSelectedId(data.summary.strongestEventId)}
              >
                Show strongest
              </button>
            </div>
            <div className="quake-map-layout">
              <div className="quake-world-map" aria-label="Map of recent global earthquakes">
                <WorldOutline />
                {data.events.map((event, index) => (
                  <button
                    aria-label={`${formatMagnitude(event.magnitude)} near ${event.place}`}
                    className={`quake-marker quake-marker-${magnitudeClass(event.magnitude)} ${selected?.id === event.id ? "is-selected" : ""}`}
                    key={event.id}
                    onClick={() => selectFromMap(event, index + 1)}
                    style={{
                      left: `${((event.longitude + 180) / 360) * 100}%`,
                      top: `${((90 - event.latitude) / 180) * 100}%`,
                      width: `${markerSize(event.magnitude)}px`,
                      height: `${markerSize(event.magnitude)}px`,
                    }}
                    title={`${formatMagnitude(event.magnitude)} · ${event.place}`}
                    type="button"
                  />
                ))}
                <div className="quake-map-legend" aria-hidden="true"><span /> M5+ <span /> M4-4.9 <span /> Below M4</div>
              </div>
              {selected ? <SelectedEvent event={selected} /> : null}
            </div>
          </section>

          <section className="quake-trends" aria-labelledby="quake-trends-title">
            <div className="quake-section-heading">
              <div>
                <p className="section-eyebrow">Observed activity</p>
                <h2 id="quake-trends-title">24-hour patterns</h2>
              </div>
              <p>Counts describe reported activity, not future risk.</p>
            </div>
            <div className="quake-chart-grid">
              <BarChart title="By magnitude" items={data.trends.magnitudeBands.map((band) => ({ label: band.label, value: band.count }))} />
              <BarChart
                title="By 3-hour interval (UTC)"
                items={data.trends.threeHourBuckets.map((bucket) => ({ label: formatBucket(bucket.start), value: bucket.count }))}
                compact
              />
            </div>
          </section>

          <section className="quake-events-section" aria-labelledby="quake-events-title">
            <div className="quake-section-heading quake-events-heading">
              <div>
                <p className="section-eyebrow">USGS catalogue</p>
                <h2 id="quake-events-title">Recent earthquakes</h2>
              </div>
              <div className="quake-controls">
                <div className="quake-segmented" aria-label="Filter by magnitude" role="group">
                  {(["all", "m4", "m5"] as EarthquakeFilter[]).map((option) => (
                    <button
                      aria-pressed={filter === option}
                      className={filter === option ? "is-active" : ""}
                      key={option}
                      onClick={() => changeFilter(option)}
                      type="button"
                    >
                      {option === "all" ? "All" : `${option.toUpperCase()}+`}
                    </button>
                  ))}
                </div>
                <label>
                  <span>Sort</span>
                  <select value={sort} onChange={(event) => setSort(event.target.value as EarthquakeSort)}>
                    <option value="newest">Newest</option>
                    <option value="magnitude">Strongest</option>
                    <option value="depth">Shallowest</option>
                  </select>
                </label>
              </div>
            </div>
            <div className="quake-table-wrap">
              <table className="quake-table">
                <thead><tr><th>Magnitude</th><th>Location</th><th>Time</th><th>Depth</th><th>Source</th></tr></thead>
                <tbody>
                  {events.map((event, index) => (
                    <tr key={event.id}>
                      <td data-label="Magnitude"><strong className={`quake-mag quake-mag-${magnitudeClass(event.magnitude)}`}>{formatMagnitude(event.magnitude)}</strong></td>
                      <td data-label="Location"><button className="quake-place-button" type="button" onClick={() => { setSelectedId(event.id); trackEarthquakeEventOpen(event.id, event.magnitude, index + 1); }}>{event.place}</button></td>
                      <td data-label="Time"><time dateTime={event.occurredAt}>{formatEventTime(event.occurredAt)}</time></td>
                      <td data-label="Depth">{event.depthKm.toFixed(1)} km</td>
                      <td data-label="Source"><a href={event.url} onClick={() => trackEarthquakeUsgsClick(event.id, event.magnitude, "earthquake_table")} rel="noreferrer" target="_blank">USGS</a></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!events.length ? <p className="quake-empty">No earthquakes match this magnitude filter.</p> : null}
            </div>
          </section>

          <section className="quake-explainer" aria-labelledby="quake-explainer-title">
            <div className="quake-section-heading">
              <div><p className="section-eyebrow">Reading the data</p><h2 id="quake-explainer-title">How to use this map</h2></div>
            </div>
            <div className="quake-explainer-grid">
              <article><h3>Magnitude</h3><p>Magnitude measures the size of an earthquake at its source. Each whole-number increase represents a large increase in recorded ground motion.</p></article>
              <article><h3>Depth</h3><p>Depth is the value reported by USGS. It may occasionally be slightly negative relative to the reference datum. XLB labels values under 70 km as shallow only for descriptive grouping.</p></article>
              <article><h3>Activity context</h3><p>The comparison uses the daily average from the previous six days in the USGS weekly feed. It describes recent reporting, not danger or prediction.</p></article>
            </div>
            <p className="quake-disclaimer">Earthquakes cannot be predicted by this page. Follow local authorities and the USGS for authoritative hazard information.</p>
            <nav className="quake-related" aria-label="Related earthquake pages">
              <Link to="/topics/earthquakes">Earthquakes topic</Link>
              <Link to="/live">Live streams</Link>
              <Link to="/gallery">Earthquake visuals</Link>
            </nav>
          </section>
        </>
      ) : null}
    </>
  );
}

function Metric({ label, value, detail, tone = "mint" }: { label: string; value: string; detail?: string; tone?: "mint" | "blue" | "warm" }) {
  return <article className={`quake-metric quake-metric-${tone}`}><span>{label}</span><strong>{value}</strong>{detail ? <small>{detail}</small> : null}</article>;
}

function ReturnDelta({ delta }: { delta: EarthquakeReturnDelta }) {
  return (
    <section className="quake-return" aria-live="polite">
      <div><p className="section-eyebrow">Since your last visit</p><strong>{delta.newCount} new earthquakes</strong></div>
      <span>{delta.newM4Plus} new M4+ events</span>
      <span>{delta.strongestNew ? `Strongest new: ${formatMagnitude(delta.strongestNew.magnitude)} near ${delta.strongestNew.place}` : "No newly reported event in this snapshot"}</span>
    </section>
  );
}

function SelectedEvent({ event }: { event: EarthquakeEvent }) {
  return (
    <article className="quake-selected">
      <p className="section-eyebrow">Selected event</p>
      <div className="quake-selected-mag">{formatMagnitude(event.magnitude)}</div>
      <h3>{event.place}</h3>
      <dl><div><dt>Depth</dt><dd>{event.depthKm.toFixed(1)} km</dd></div><div><dt>Time</dt><dd>{formatEventTime(event.occurredAt)}</dd></div><div><dt>Coordinates</dt><dd>{event.latitude.toFixed(2)}, {event.longitude.toFixed(2)}</dd></div></dl>
      <a href={event.url} onClick={() => trackEarthquakeUsgsClick(event.id, event.magnitude, "earthquake_map_detail")} rel="noreferrer" target="_blank">View event at USGS</a>
    </article>
  );
}

function WorldOutline() {
  return (
    <svg aria-hidden="true" className="quake-world-outline" viewBox="0 0 1000 500" preserveAspectRatio="none">
      <path d="M72 118l50-43 79 8 35 39 81 25 27 55-43 34-25 59-47 26-36-67-54-19-31-48-47-14zM286 328l52 31 22 83-29 49-35-44-20-73zM476 102l70-44 62 20 24 38 82 13 48 48-22 41-71 1-48 36-43-22-13-53-67-15-43-31zM583 245l64 17 37 61-21 99-55 39-48-64 7-79zM760 335l77-35 79 28 24 61-62 50-93-17-38-49zM891 118l36-20 25 31-18 28-38-9z" />
      <g><line x1="0" y1="125" x2="1000" y2="125"/><line x1="0" y1="250" x2="1000" y2="250"/><line x1="0" y1="375" x2="1000" y2="375"/><line x1="250" y1="0" x2="250" y2="500"/><line x1="500" y1="0" x2="500" y2="500"/><line x1="750" y1="0" x2="750" y2="500"/></g>
    </svg>
  );
}

function BarChart({ title, items, compact = false }: { title: string; items: Array<{ label: string; value: number }>; compact?: boolean }) {
  const max = Math.max(...items.map((item) => item.value), 1);
  return <article className={`quake-chart ${compact ? "is-compact" : ""}`}><h3>{title}</h3><div>{items.map((item) => <div className="quake-bar-row" key={item.label}><span>{item.label}</span><i><b style={{ width: `${(item.value / max) * 100}%` }} /></i><strong>{item.value}</strong></div>)}</div></article>;
}

function EarthquakeSkeleton() {
  return <section className="quake-state quake-loading" aria-busy="true"><span /><span /><span /><p>Loading the latest USGS earthquake snapshot...</p></section>;
}

function formatMagnitude(value: number | null) { return value === null ? "—" : `M${value.toFixed(1)}`; }
function formatDifference(value: number) { return `${value > 0 ? "+" : ""}${value.toFixed(1)}`; }
function formatUpdated(value: string) { return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value)) + " UTC"; }
function formatEventTime(value: string) { return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC", timeZoneName: "short" }).format(new Date(value)); }
function formatBucket(value: string) { return new Intl.DateTimeFormat("en", { hour: "numeric", timeZone: "UTC" }).format(new Date(value)); }
function markerSize(magnitude: number) { return Math.max(8, Math.min(25, 6 + magnitude * 2.5)); }
function magnitudeClass(magnitude: number) { return magnitude >= 5 ? "high" : magnitude >= 4 ? "medium" : "low"; }
