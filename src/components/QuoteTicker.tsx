import { QuoteItem } from "../types/content";
import { SectionHeader } from "./SectionHeader";

interface QuoteTickerProps {
  items?: QuoteItem[];
  loading: boolean;
  error: string | null;
  updatedAt?: string;
}

export function QuoteTicker({
  items,
  loading,
  error,
  updatedAt,
}: QuoteTickerProps) {
  const repeated = items ? [...items, ...items] : [];

  return (
    <section id="quotes" className="section-block">
      <SectionHeader
        eyebrow="Mindset"
        title="Quote drift"
        description="A gentle feed for mood, perspective, and reset."
        updatedAt={updatedAt}
      />
      <div className="quote-shell">
        {loading ? (
          <div className="quote-placeholder card-skeleton">
            <div className="skeleton-line skeleton-title" />
            <div className="skeleton-line skeleton-copy" />
          </div>
        ) : null}
        {error ? (
          <div className="quote-placeholder card-error">
            <p>Quotes are unavailable right now.</p>
          </div>
        ) : null}
        {items?.length ? (
          <div className="quote-marquee">
            <div className="quote-track">
              {repeated.map((item, index) => (
                <article className="quote-card" key={`${item.id}-${index}`}>
                  <p>“{item.quote}”</p>
                  <footer>
                    <span>{item.author}</span>
                    <span>{item.context}</span>
                  </footer>
                </article>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
