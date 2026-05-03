declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim();

let analyticsBooted = false;

function hasMeasurementId() {
  return Boolean(measurementId);
}

export function ensureAnalytics() {
  if (!hasMeasurementId() || typeof document === "undefined" || analyticsBooted) {
    return;
  }

  if (typeof window.gtag === "function") {
    analyticsBooted = true;
    return;
  }

  const existingScript = document.querySelector(`script[data-analytics-id="${measurementId}"]`);
  if (!existingScript) {
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    script.dataset.analyticsId = measurementId;
    document.head.appendChild(script);
  }

  window.dataLayer = window.dataLayer ?? [];
  window.gtag =
    window.gtag ??
    function gtag(...args: unknown[]) {
      window.dataLayer?.push(args);
    };

  window.gtag("js", new Date());
  window.gtag("config", measurementId, {
    send_page_view: false,
  });

  analyticsBooted = true;
}

export function trackPageView(path: string, title: string) {
  if (!hasMeasurementId()) {
    return;
  }

  ensureAnalytics();
  window.gtag?.("event", "page_view", {
    page_path: path,
    page_title: title,
    page_location: `${window.location.origin}${path}`,
  });
}

type AnalyticsParams = Record<string, string | number | boolean | undefined>;

export function trackEvent(name: string, params: AnalyticsParams = {}) {
  if (!hasMeasurementId()) {
    return;
  }

  ensureAnalytics();
  window.gtag?.("event", name, params);
}

type OutboundEvent = {
  destination: string;
  label: string;
  category: string;
  context?: string;
};

export function trackOutboundClick({ destination, label, category, context }: OutboundEvent) {
  trackEvent(category, {
    event_category: "outbound_link",
    event_label: label,
    link_url: destination,
    link_domain: safeDomain(destination),
    context,
    outbound: true,
  });
}

export function trackVideoPlayStart(videoId: string, title: string, relatedPath: string) {
  trackEvent("video_play_start", {
    video_id: videoId,
    video_title: title,
    related_path: relatedPath,
  });
}

export function trackVideoPlayComplete(videoId: string, title: string, secondsWatched: number) {
  trackEvent("video_play_complete", {
    video_id: videoId,
    video_title: title,
    seconds_watched: secondsWatched,
  });
}

export function trackVideoScrollDepth(depth: number) {
  trackEvent("video_scroll_depth", {
    depth_percent: depth,
  });
}

export function trackGameLifecycle(eventName: "game_start" | "game_complete", mode: string, score?: number) {
  trackEvent(eventName, {
    game_mode: mode,
    score,
  });
}

export function trackGalleryOpen(collectionId: string, entryId: string, href: string) {
  trackEvent("gallery_card_open", {
    collection_id: collectionId,
    entry_id: entryId,
    target_path: href,
  });
}

export function trackHomeLiveCardClick(moduleId: string, href: string) {
  trackEvent("home_live_card_click", {
    module_id: moduleId,
    target_path: href,
  });
}

export function trackReturnVisitEntry(path: string) {
  trackEvent("return_visit_entry", {
    entry_path: path,
  });
}

function safeDomain(value: string) {
  try {
    return new URL(value).hostname;
  } catch {
    return "";
  }
}
