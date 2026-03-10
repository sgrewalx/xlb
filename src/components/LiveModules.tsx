import { LiveModule } from "../types/content";
import { SectionHeader } from "./SectionHeader";

interface LiveModulesProps {
  items?: LiveModule[];
  loading: boolean;
  error: string | null;
  updatedAt?: string;
}

export function LiveModules({
  items,
  loading,
  error,
  updatedAt,
}: LiveModulesProps) {
  return (
    <section id="live-world" className="section-block">
      <SectionHeader
        eyebrow="Live world"
        title="World in motion"
        description="Curiosity modules designed for safe link-outs now and richer reviewed integrations later."
        updatedAt={updatedAt}
      />
      <div className="module-grid">
        {loading
          ? Array.from({ length: 6 }).map((_, index) => (
              <article className="card card-skeleton module-card" key={index}>
                <div className="visual-skeleton module-skeleton" />
                <div className="skeleton-line skeleton-title" />
                <div className="skeleton-line skeleton-copy" />
              </article>
            ))
          : null}

        {error ? (
          <article className="card card-error">
            <p>Live modules unavailable.</p>
            <span>{error}</span>
          </article>
        ) : null}

        {items?.map((item) => (
          <article className="card module-card" key={item.id}>
            <img src={item.image} alt="" loading="lazy" />
            <div className="card-chip-row">
              <span className="chip">{item.provider}</span>
              <span className="muted">{item.mode}</span>
            </div>
            <h3>{item.title}</h3>
            <p>{item.description}</p>
            <div className="metric-grid">
              {item.metrics.map((metric) => (
                <div className="metric-pill" key={`${item.id}-${metric.label}`}>
                  <span>{metric.label}</span>
                  <strong>{metric.value}</strong>
                </div>
              ))}
            </div>
            <div className="module-footer">
              <small>{item.safeNote}</small>
              <a href={item.actionUrl} target="_blank" rel="noreferrer">
                {item.actionLabel}
              </a>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
