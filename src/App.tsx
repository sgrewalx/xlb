import { useEffect } from "react";
import { Link, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { Footer } from "./components/Footer";
import { HomePage } from "./pages/HomePage";
import { StaticPage } from "./pages/StaticPage";

const aboutSections = [
  {
    heading: "What XLB is",
    body: "XLB is a static-first ambient dashboard built for quick awareness, visual curiosity, and low-friction discovery. It is intentionally lightweight and does not try to be a full portal.",
  },
  {
    heading: "How it is powered",
    body: "Homepage sections are driven by JSON manifests so scheduled jobs, GitHub Actions, or future agents can refresh content without rewriting the frontend.",
  },
  {
    heading: "Operating principle",
    body: "A little of everything. Nothing overwhelming. Every module should earn its place by being fast, clean, safe, and replaceable.",
  },
];

const privacySections = [
  {
    heading: "Data stance",
    body: "The MVP does not require accounts, logins, or a database. Client-side analytics hooks can be added later with a privacy-friendly provider such as Plausible.",
  },
  {
    heading: "External links",
    body: "Some cards link to reviewed third-party destinations. Those sites apply their own terms and privacy policies when you leave XLB.",
  },
  {
    heading: "Future analytics",
    body: "If analytics are enabled later, XLB should disclose the provider, the exact event collection scope, and a minimal-retention policy.",
  },
];

const termsSections = [
  {
    heading: "Use of service",
    body: "XLB is provided as an informational and entertainment dashboard. Content is presented on a best-effort basis and may change or be removed at any time.",
  },
  {
    heading: "Content rights",
    body: "The MVP stores links, short labels, and curated original artwork. It should not store full copyrighted articles or unlicensed media from external publishers.",
  },
  {
    heading: "Availability",
    body: "Because the site is static and feed-driven, sections may occasionally show placeholders, stale timestamps, or external-source outages.",
  },
];

const contactSections = [
  {
    heading: "Editorial and platform",
    body: "For product, content, or automation questions, route requests to the CodeMachine team email configured for xlb.codemachine.in.",
  },
  {
    heading: "Abuse or safety reports",
    body: "Potentially unsafe links, broken feeds, or policy issues should trigger a manifest rollback and provider review before the module is re-enabled.",
  },
  {
    heading: "Infrastructure owner",
    body: "Keep AWS, DNS, and CI access under least privilege with separate deploy and read-only roles.",
  },
];

const advertiseSections = [
  {
    heading: "Ad model",
    body: "The MVP reserves sponsor surfaces without degrading the reading flow. Future placements should be direct-sold, premium, and clearly labeled.",
  },
  {
    heading: "Formats",
    body: "Recommended formats are static or lightweight HTML creatives, section sponsorships, and branded curiosity modules reviewed for safety and performance.",
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

function AppChrome() {
  return (
    <div className="site-shell">
      <header className="site-header">
        <div className="brand-row">
          <Link className="brand-mark" to="/">
            <span>XLB</span>
            <small>ambient dashboard</small>
          </Link>
          <nav className="site-nav" aria-label="Primary">
            <a href="/#news">News</a>
            <a href="/#sports">Sports</a>
            <a href="/#live-world">Live World</a>
            <a href="/#visuals">Visuals</a>
            <NavLink to="/about">About</NavLink>
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
                description="What XLB is, how it is built, and why the experience stays intentionally light."
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
                description="XLB operates without accounts or a user database in the MVP."
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
                description="Simple operating terms for a static, feed-driven dashboard."
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
                description="Operational contact guidance for platform, safety, and infrastructure requests."
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
                description="Future sponsor surfaces should be clean, direct, labeled, and performance-safe."
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
