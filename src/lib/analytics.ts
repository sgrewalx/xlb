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

type OutboundEvent = {
  destination: string;
  label: string;
  category: string;
  context?: string;
};

export function trackOutboundClick({ destination, label, category, context }: OutboundEvent) {
  if (!hasMeasurementId()) {
    return;
  }

  ensureAnalytics();
  window.gtag?.("event", category, {
    event_category: "outbound_link",
    event_label: label,
    link_url: destination,
    link_domain: safeDomain(destination),
    context,
    outbound: true,
  });
}

function safeDomain(value: string) {
  try {
    return new URL(value).hostname;
  } catch {
    return "";
  }
}
