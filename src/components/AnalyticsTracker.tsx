import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { ensureAnalytics, trackPageView } from "../lib/analytics";

export function AnalyticsTracker() {
  const location = useLocation();

  useEffect(() => {
    ensureAnalytics();
  }, []);

  useEffect(() => {
    trackPageView(`${location.pathname}${location.search}${location.hash}`, document.title);
  }, [location.hash, location.pathname, location.search]);

  return null;
}
