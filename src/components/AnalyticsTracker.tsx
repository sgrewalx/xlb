import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { ensureAnalytics, trackPageView, trackReturnVisitEntry } from "../lib/analytics";

const VISITED_PATHS_KEY = "xlb:visited-paths";

export function AnalyticsTracker() {
  const location = useLocation();

  useEffect(() => {
    ensureAnalytics();
  }, []);

  useEffect(() => {
    const currentPath = `${location.pathname}${location.search}${location.hash}`;
    trackPageView(currentPath, document.title);

    const storedValue = window.localStorage.getItem(VISITED_PATHS_KEY);
    const visitedPaths = new Set(storedValue ? JSON.parse(storedValue) as string[] : []);

    if (visitedPaths.has(location.pathname)) {
      trackReturnVisitEntry(location.pathname);
    } else {
      visitedPaths.add(location.pathname);
      window.localStorage.setItem(VISITED_PATHS_KEY, JSON.stringify([...visitedPaths]));
    }
  }, [location.hash, location.pathname, location.search]);

  return null;
}
