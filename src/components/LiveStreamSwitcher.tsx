import { useEffect, useMemo, useState } from "react";
import { LiveStreamCategory, LiveStreamItem, getLiveStreams } from "../lib/liveStreams";

interface LiveStreamSwitcherProps {
  category?: LiveStreamCategory;
}

export function LiveStreamSwitcher({ category }: LiveStreamSwitcherProps) {
  const streams = useMemo(() => getLiveStreams(category), [category]);
  const [activeId, setActiveId] = useState(streams[0]?.id ?? "");

  useEffect(() => {
    if (!streams.some((item) => item.id === activeId)) {
      setActiveId(streams[0]?.id ?? "");
    }
  }, [activeId, streams]);

  const activeStream = streams.find((item) => item.id === activeId) ?? streams[0] ?? null;

  if (!activeStream) {
    return null;
  }

  return (
    <>
      <section className="live-page-hero home-traffic-hero">
        <div className="live-page-hero-copy">
          <div className="hero-pill-row">
            <span className="chip chip-space">Live Now</span>
            {streams.map((stream) => (
              <button
                className={`hero-pill-link ${stream.id === activeStream.id ? "is-active" : ""}`}
                key={stream.id}
                onClick={() => setActiveId(stream.id)}
                type="button"
              >
                {stream.title}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="section-block">
        <article className="card home-video-card home-video-card-full live-switcher-card">
          <div className="short-card-player">
            <iframe
              src={activeStream.embedUrl}
              title={activeStream.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="eager"
            />
          </div>
          <div className="live-switcher-meta">
            <div>
              <p className="live-event-topic">{activeStream.provider}</p>
              <h2>{activeStream.title}</h2>
              <p>{activeStream.note}</p>
            </div>
            <a className="event-related-link" href={activeStream.sourceUrl} rel="noreferrer" target="_blank">
              Open source
            </a>
          </div>
        </article>
      </section>
    </>
  );
}
