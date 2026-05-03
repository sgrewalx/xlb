import { lazy, Suspense, useEffect, useState } from "react";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import { AnalyticsTracker } from "./components/AnalyticsTracker";
import { Footer } from "./components/Footer";
import { useContent } from "./hooks/useContent";
import { EventPage } from "./pages/EventPage";
import { GalleryPage } from "./pages/GalleryPage";
import { GamesPage } from "./pages/GamesPage";
import { HomePage } from "./pages/HomePage";
import { LiveEventsPage } from "./pages/LiveEventsPage";
import { NewsPage } from "./pages/NewsPage";
import { SportsPage } from "./pages/SportsPage";
import { StaticPage } from "./pages/StaticPage";
import { TechPage } from "./pages/TechPage";
import { TopicPage } from "./pages/TopicPage";
import { VideoPage } from "./pages/VideoPage";
import { QuoteFeed, QuoteItem } from "./types/content";

const OpsDashboardPage = import.meta.env.DEV ? lazy(() => import("./pages/OpsDashboardPage")) : null;

const LAST_QUOTE_KEY = "xlb:last-quote-id";

const aboutSections = [
  {
    heading: "What XLB is",
    body: "XLB is evolving into a live-events destination focused on public-interest moments across space and earth topics.",
  },
  {
    heading: "Operating principle",
    body: "Use automation for monitoring, ranking, and iteration, while keeping humans in the loop for higher-risk decisions.",
  },
];

const privacySections = [
  {
    heading: "Data stance",
    body: "We do not have any logins etc. and we store minimal data as of now.",
  },
  {
    heading: "External links",
    body: "Some cards link to reviewed third-party destinations. Those sites apply their own terms and privacy policies when you leave XLB.",
  },
];

const termsSections = [
  {
    heading: "Use of service",
    body: "XLB is an informational and entertainment site. Content is presented on a best-effort basis and may change or be removed at any time.",
  },
  {
    heading: "Content rights",
    body: "XLB links to external sources and uses original site artwork. Third-party content remains the property of its respective owners.",
  },
  {
    heading: "Availability",
    body: "Since the site is feed-driven, sections may occasionally show placeholders, stale timestamps, or external-source outages.",
  },
];

const contactSections = [
  {
    heading: "Editorial and platform",
    body: "For product, content, or automation questions, route requests to info@codemachine.in",
  },
  {
    heading: "Abuse or safety reports",
    body: "Potenially unsafe links, broken feeds, or any other policy related issues, contact info@codemachine.in",
  },
];

const advertiseSections = [
  {
    heading: "Ad model",
    body: "XLB would optimize to reserve sponsor surfaces without degrading the reading flow.",
  },
  {
    heading: "Formats",
    body: "Static or lightweight HTML creatives, section sponsorships, and branded curiosity modules reviewed for safety and performance.",
  },
  {
    heading: "Guardrails",
    body: "No deceptive ads, forced redirects, autoplay audio, malware-like behavior, adult content, gambling gray zones, or layout-shifting networks.",
  },
];

function ScrollToTop() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [location.pathname]);

  return null;
}

function HeaderQuote({
  items,
  loading,
  error,
}: {
  items?: QuoteItem[];
  loading: boolean;
  error: string | null;
}) {
  const [selectedQuote, setSelectedQuote] = useState<QuoteItem | null>(null);

  useEffect(() => {
    if (!items?.length) {
      setSelectedQuote(null);
      return;
    }

    const previousId = window.localStorage.getItem(LAST_QUOTE_KEY);
    const pool =
      items.length > 1 && previousId
        ? items.filter((quote) => quote.id !== previousId)
        : items;
    const nextQuote = pool[Math.floor(Math.random() * pool.length)] ?? items[0];

    setSelectedQuote(nextQuote);
    window.localStorage.setItem(LAST_QUOTE_KEY, nextQuote.id);
  }, [items]);

  if (loading) {
    return (
      <div className="header-quote-strip">
        <span>Loading quote...</span>
      </div>
    );
  }

  if (error || !selectedQuote) {
    return null;
  }

  return (
    <div className="header-quote-strip">
      <p>“{selectedQuote.quote}”</p>
      <span>{selectedQuote.author}</span>
    </div>
  );
}

function AppChrome() {
  const quotes = useContent<QuoteFeed>("/content/quotes/quotes.json");
  const location = useLocation();
  const isOpsView = import.meta.env.DEV && location.pathname === "/__ops";

  return (
    <div className="site-shell">
      <AnalyticsTracker />
      {isOpsView ? (
        <header className="ops-shell-header">
          <Link className="brand-mark" to="/">
            <span>XLB</span>
          </Link>
          <div className="ops-shell-meta">
            <span>Local Ops</span>
            <small>Visible only in development</small>
          </div>
        </header>
      ) : (
        <header className="site-header">
          <HeaderQuote
            items={quotes.data?.items}
            loading={quotes.loading}
            error={quotes.error}
          />
          <div className="brand-row">
            <Link className="brand-mark" to="/">
              <span>XLB</span>
            </Link>
            <nav className="site-nav" aria-label="Primary">
              <Link to="/live">Live</Link>
              <Link to="/video">Video</Link>
              <Link to="/live/space">Space</Link>
              <Link to="/live/earth">Earth</Link>
              <Link to="/games">Games</Link>
              <Link to="/gallery">Gallery</Link>
              <Link to="/sports">Sports</Link>
              <Link to="/news">News</Link>
              <Link to="/tech">Tech</Link>
            </nav>
          </div>
        </header>
      )}
      <main className="page-shell">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/live" element={<LiveEventsPage />} />
          <Route path="/live/:category" element={<LiveEventsPage />} />
          <Route path="/events/:slug" element={<EventPage />} />
          <Route path="/topics/:slug" element={<TopicPage />} />
          <Route path="/games" element={<GamesPage />} />
          <Route path="/gallery" element={<GalleryPage />} />
          <Route path="/sports" element={<SportsPage />} />
          <Route path="/news" element={<NewsPage />} />
          <Route path="/tech" element={<TechPage />} />
          <Route path="/video" element={<VideoPage />} />
          {OpsDashboardPage ? (
            <Route
              path="/__ops"
              element={
                <Suspense
                  fallback={
                    <StaticPage
                      title="Loading ops dashboard | XLB"
                      description="Loading local ops data."
                      path="/__ops"
                      eyebrow="Ops"
                      sections={[
                        {
                          heading: "Loading",
                          body: "Reading local automation reports and snapshots.",
                        },
                      ]}
                    />
                  }
                >
                  <OpsDashboardPage />
                </Suspense>
              }
            />
          ) : null}
          <Route
            path="/about"
            element={
              <StaticPage
                title="About | XLB"
                description=""
                path="/about"
                eyebrow="About"
                sections={aboutSections}
              />
            }
          />
          <Route
            path="/privacy"
            element={
              <StaticPage
                title="Privacy | XLB"
                description="XLB stores minimal data."
                path="/privacy"
                eyebrow="Privacy"
                sections={privacySections}
              />
            }
          />
          <Route
            path="/terms"
            element={
              <StaticPage
                title="Terms | XLB"
                description="Nothing complicated"
                path="/terms"
                eyebrow="Terms"
                sections={termsSections}
              />
            }
          />
          <Route
            path="/contact"
            element={
              <StaticPage
                title="Contact | XLB"
                description="Operational contact information for platform, safety, or any other feedback."
                path="/contact"
                eyebrow="Contact"
                sections={contactSections}
              />
            }
          />
          <Route
            path="/advertise"
            element={
              <StaticPage
                title="Advertise | XLB"
                description="Clean, direct, labeled and performance-safe surfaces."
                path="/advertise"
                eyebrow="Advertise"
                sections={advertiseSections}
              />
            }
          />
          <Route
            path="*"
            element={
              <StaticPage
                title="Not found | XLB"
                description="The page you requested is not available."
                path="/404"
                robots="noindex,follow"
                eyebrow="404"
                sections={[
                  {
                    heading: "Return to dashboard",
                    body: "Use the main navigation to get back to the homepage or one of the static support pages.",
                  },
                ]}
              />
            }
          />
        </Routes>
      </main>
      {isOpsView ? null : <Footer />}
    </div>
  );
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <AppChrome />
    </>
  );
}
