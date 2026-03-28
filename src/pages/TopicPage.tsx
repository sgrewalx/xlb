import { Link, useParams } from "react-router-dom";
import { Seo } from "../components/Seo";
import { useContent } from "../hooks/useContent";
import { LiveEventsFeed, LiveEventScoreboard, TopicsFeed } from "../types/content";

export function TopicPage() {
  const { slug } = useParams();
  const topics = useContent<TopicsFeed>("/content/topics/index.json");
  const events = useContent<LiveEventsFeed>("/content/live/events.json");
  const scoreboard = useContent<LiveEventScoreboard>("/content/live/scoreboard.json");

  const topic = topics.data?.items.find((item) => item.slug === slug);
  const topicEvents = (events.data?.items ?? []).filter((item) => item.topic === slug);
  const sourceCount = new Set(topicEvents.map((item) => item.sourceName)).size;
  const monitoringCount = topicEvents.filter((item) => item.status === "monitoring" || item.status === "watch").length;

  if (topics.loading || events.loading) {
    return (
      <section className="section-block">
        <div className="card card-skeleton live-event-detail">
          <div className="skeleton-line skeleton-tag" />
          <div className="skeleton-line skeleton-title" />
          <div className="skeleton-line skeleton-copy" />
        </div>
      </section>
    );
  }

  if (!topic) {
    return (
      <>
        <Seo title="Topic not found | XLB" description="The requested topic is not available." path="/404" />
        <section className="static-hero">
          <p className="section-eyebrow">Topic</p>
          <h1>Topic not found</h1>
          <p>This topic may have been pruned or not generated yet.</p>
        </section>
      </>
    );
  }

  return (
    <>
      <Seo title={`${topic.title} | XLB`} description={topic.summary} path={`/topics/${topic.slug}`} />
      <section className={`live-page-hero live-page-hero-${topic.category}`}>
        <div className="live-page-hero-copy">
          <p className="section-eyebrow">Topic</p>
          <h1>{topic.title}</h1>
          <p>{topic.summary}</p>
        </div>
        <div className="live-page-hero-rail">
          <div className="signal-panel">
            <span>Events</span>
            <strong>{topic.eventCount}</strong>
          </div>
          <div className="signal-panel">
            <span>Live now</span>
            <strong>{monitoringCount}</strong>
          </div>
          <div className="signal-panel">
            <span>Sources</span>
            <strong>{sourceCount}</strong>
          </div>
        </div>
      </section>
      <section className="section-block">
        <div className="topic-summary-grid">
          <article className="card event-copy-card">
            <p className="section-eyebrow">Overview</p>
            <h2>Why people follow this topic</h2>
            <p>
              This page gathers the key moments in one place so it is easier to follow the story,
              jump between related events, and come back when something changes.
            </p>
            <div className="topic-signal-row">
              <div className="metric-pill">
                <span>Tracked</span>
                <strong>{topic.eventCount}</strong>
              </div>
              <div className="metric-pill">
                <span>Promoted</span>
                <strong>{topic.promotedEventCount}</strong>
              </div>
            </div>
          </article>
          <article className="card event-copy-card">
            <p className="section-eyebrow">Coverage</p>
            <h2>Tracked events</h2>
            <div className="event-related-list">
              {topicEvents.map((event) => (
                <Link className="event-related-link" key={event.id} to={`/events/${event.slug}`}>
                  {event.title}
                </Link>
              ))}
            </div>
          </article>
        </div>
      </section>
      <section className="section-block">
        <div className="live-events-grid">
          {topicEvents.map((event) => {
            const score = scoreboard.data?.items.find((item) => item.slug === event.slug);

            return (
              <article className="card live-event-card" key={event.id}>
                <div className="live-event-card-top">
                  <div className="card-chip-row">
                    <span className={`chip chip-${event.category}`}>{event.category}</span>
                    <span className={`live-status live-status-${event.status}`}>{event.status}</span>
                  </div>
                  <p className="live-event-topic">{event.topic}</p>
                </div>
                <div className="live-event-body">
                  <h3>{event.title}</h3>
                  <p>{event.summary}</p>
                </div>
                <div className="live-event-meta">
                  <div>
                    <span className="muted">Source</span>
                    <strong>{event.sourceName}</strong>
                  </div>
                  <div>
                    <span className="muted">Status</span>
                    <strong>{event.status}</strong>
                  </div>
                </div>
                <div className="live-event-actions">
                  <Link className="ghost-button" to={`/events/${event.slug}`}>
                    Open event
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}
