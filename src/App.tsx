import { useEffect, useState } from "react";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import { Footer } from "./components/Footer";
import { useContent } from "./hooks/useContent";
import { HomePage } from "./pages/HomePage";
import { StaticPage } from "./pages/StaticPage";
import { QuoteFeed, QuoteItem } from "./types/content";

const LAST_QUOTE_KEY = "xlb:last-quote-id";

const aboutSections = [
  {
    heading: "What XLB is",
    body: "XLB is about Experience, Love, Bond.",
  },
  {
    heading: "Operating principle",
    body: "A little bit of everything. Nothing overwhelming. Just take it easy.",
  },
];

const privacySections = [
  {
    heading: "Data stance",
    body: "We do not have any logins etc. and we store minimal data as of now",
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

  return (
    <div className="site-shell">
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
            <a href="/#games">Games</a>
            <a href="/#live-world">Live World</a>
            <a href="/#visuals">Gallery</a>
            <a href="/#sports">Sports</a>
            <a href="/#news">News</a>
          </nav>
        </div>
      </header>
      <main className="page-shell">
        <Routes>
          <Route path="/" element={<HomePage />} />
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
      <Footer />
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
